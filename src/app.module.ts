import { BuyersModule } from './analytics/buyers/buyers.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OverviewModule } from './analytics/overview/overview.module';
import { SuppliersModule } from './analytics/suppliers/suppliers.module';
import { AuthModule } from './auth/auth.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { RegistryImportModule } from './registry-import/registry-import.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BuyersModule,
    OverviewModule,
    SuppliersModule,
    PrismaModule,
    AuthModule,
    RegistryImportModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
