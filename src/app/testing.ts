/** TODO(Q-11): 单独入口防止 Metro 将 node:sqlite 打入设备包。 */
import { openMemoryDb } from '@data/drivers/nodeSqlite';
import { createRecordedFetch } from '@services/ai/fake';
import { createTestClock } from './clock';
import { seedDemo } from './demo/seed';
import {
  createContainer,
  type Container,
  type ContainerOptions,
} from './container';

export function createTestContainer(
  over: Partial<Container> = {},
  options: ContainerOptions = {},
): Promise<Container> {
  return createContainer(
    over.db ?? openMemoryDb(),
    {
      clock: createTestClock(),
      mode: 'test',
      ...over,
    },
    { fetchImpl: createRecordedFetch([]), ...options },
  );
}

/** Node test entry remains separate from device code so Metro never loads node:sqlite. */
export async function createTestDemoContainer(
  over: Partial<Container> = {},
  options: ContainerOptions = {},
): Promise<Container> {
  const container = await createTestContainer(
    { ...over, mode: 'demo' },
    options,
  );
  try {
    await seedDemo(container.db, container.clock);
    return container;
  } catch (error) {
    await container.close();
    throw error;
  }
}
