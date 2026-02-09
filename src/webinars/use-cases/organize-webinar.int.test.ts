import { PrismaClient } from '@prisma/client';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { exec } from 'child_process';
import { FixedDateGenerator } from 'src/core/adapters/fixed-date-generator';
import { FixedIdGenerator } from 'src/core/adapters/fixed-id-generator';
import { PrismaWebinarRepository } from 'src/webinars/adapters/webinar-repository.prisma';
import { OrganizeWebinars } from 'src/webinars/use-cases/organize-webinar';
import { promisify } from 'util';
const asyncExec = promisify(exec);

describe('OrganizeWebinar Integration', () => {
  let container: StartedPostgreSqlContainer;
  let prismaClient: PrismaClient;
  let repository: PrismaWebinarRepository;
  let useCase: OrganizeWebinars;

  beforeAll(async () => {
    // Connect to database
    container = await new PostgreSqlContainer()
      .withDatabase('test_db')
      .withUsername('user_test')
      .withPassword('password_test')
      .withExposedPorts(5432)
      .start();

    const dbUrl = container.getConnectionUri();
    prismaClient = new PrismaClient({
      datasources: {
        db: { url: dbUrl },
      },
    });

    // Run migrations to populate the database
    await asyncExec(`set DATABASE_URL=${dbUrl} && npx prisma migrate deploy`);

    return prismaClient.$connect();
  }, 60000);

  beforeEach(async () => {
    repository = new PrismaWebinarRepository(prismaClient);
    useCase = new OrganizeWebinars(
      repository,
      new FixedIdGenerator(),
      new FixedDateGenerator(),
    );
    await prismaClient.webinar.deleteMany();
    await prismaClient.$executeRawUnsafe('DELETE FROM "Webinar" CASCADE');
  });

  afterAll(async () => {
    await container.stop({ timeout: 1000 });
    return prismaClient.$disconnect();
  });

  it('should organize a webinar and persist it', async () => {
    // ARRANGE
    const payload = {
      userId: 'organizer-id',
      title: 'Webinar title',
      seats: 100,
      startDate: new Date('2024-01-10T10:00:00.000Z'),
      endDate: new Date('2024-01-10T11:00:00.000Z'),
    };

    // ACT
    const result = await useCase.execute(payload);

    // ASSERT
    expect(result).toEqual({ id: 'id-1' });

    const persistedWebinar = await prismaClient.webinar.findUnique({
      where: { id: 'id-1' },
    });
    expect(persistedWebinar).toEqual({
      id: 'id-1',
      organizerId: 'organizer-id',
      title: 'Webinar title',
      seats: 100,
      startDate: new Date('2024-01-10T10:00:00.000Z'),
      endDate: new Date('2024-01-10T11:00:00.000Z'),
    });
  });
});
