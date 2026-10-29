import { openDeviceDb } from '@data/drivers/opSqlite';
import { createContainer, type Container } from './container';
import { seedDemo } from './demo/seed';
import { createDemoGateway } from './demo/gateway';

/** Native in-memory SQLite: no demonstration records or credentials enter pagewise.db. */
export async function createDemoContainer(): Promise<Container> {
  const container = await createContainer(
    openDeviceDb('pagewise-demo', ':memory:'),
    { mode: 'demo', ai: createDemoGateway() },
  );
  try {
    await seedDemo(container.db, container.clock);
    return container;
  } catch (error) {
    await container.close();
    throw error;
  }
}
