/** TODO(Q-11): 单独入口防止 Metro 将 node:sqlite 打入设备包。 */
import { openMemoryDb } from '@data/drivers/nodeSqlite';
import { createRecordedFetch } from '@services/ai/fake';
import { createTestClock } from './clock';
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
      ...over,
    },
    { fetchImpl: createRecordedFetch([]), ...options },
  );
}
