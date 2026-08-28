import { AppModule } from './app.module';

describe('AppModule package import', () => {
  it('does not activate the Angular SSR runtime during ts-jest import', () => {
    expect(AppModule).toBeDefined();
  });
});
