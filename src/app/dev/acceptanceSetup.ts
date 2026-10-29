import { bookFiles } from '@platform/bookFiles';
import type { Container } from '../container';
import { saveService, assignModel, patchMineru } from '../usecases/settings';
import { getParseQueue } from '../usecases/parseQueue';

/** Credentials are staged locally by the tester and removed immediately after reading. */
export async function loadAcceptanceCredentials(c: Container) {
  const path = `${bookFiles.cacheDir}/acceptance-credentials.json`;
  const config = JSON.parse(await bookFiles.readText(path));
  await bookFiles.remove(path);
  const mineruSettings = await c.repos.settings.get<Record<string, unknown>>('mineru', {});
  if ('token' in mineruSettings) {
    delete mineruSettings.token;
    await c.repos.settings.set('mineru', mineruSettings);
  }
  if (config.mineruToken) await patchMineru(c, {}, config.mineruToken);
  if (config.ai) {
    const saved = await saveService(c, {
      name: '本机验收服务',
      protocol: config.ai.protocol,
      baseUrl: config.ai.baseUrl,
      model: config.ai.model,
      key: config.ai.key,
      auth: 'bearer',
      cache: 'auto',
      effort: config.ai.effort ?? 'off',
      priceInput: '',
      priceOutput: '',
      priceCacheRead: '',
      priceCacheWrite: '',
    });
    if (!saved.ok) throw new Error('验收服务配置无效');
    await assignModel(c, 'teach', saved.providerId, config.ai.model);
    await assignModel(c, 'tidy', saved.providerId, config.ai.model);
  }
  await getParseQueue(c).resume();
}
