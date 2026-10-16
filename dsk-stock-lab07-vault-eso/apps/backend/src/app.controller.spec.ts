import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();
    appController = module.get<AppController>(AppController);
  });

  it('returns health', () => {
    expect(appController.health()).toEqual({ status: 'ok' });
  });
});
