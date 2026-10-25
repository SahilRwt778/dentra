import { PushDevicesController } from './push-devices.controller';
import { PushDevicesService } from './push-devices.service';
import { FirebasePushService } from './firebase-push.service';
import { PushDeliveryService } from './push-delivery.service';
import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { AppointmentRemindersService } from './appointment-reminders.service';

@Module({
  controllers: [PushDevicesController, NotificationsController],
  providers: [
    NotificationsService,
    AppointmentRemindersService,
    PushDevicesService,
    FirebasePushService,
    PushDeliveryService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
