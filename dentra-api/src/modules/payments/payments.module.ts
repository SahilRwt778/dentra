import { Module } from '@nestjs/common';
import { RazorpayGatewayService } from './razorpay-gateway.service';
import { PaymentsWebhookController } from './payments-webhook.controller';
import { PaymentsWebhookService } from './payments-webhook.service';
import { RefundsService } from './refunds.service';
import { RefundDeliveryService } from './refund-delivery.service';
import { PaymentExpiryService } from './payment-expiry.service';
import { PaymentReconciliationService } from './payment-reconciliation.service';
import { NotificationsModule } from '@modules/notifications/notifications.module';

/**
 * Gateway adapter, webhook, transactions — the Payments tag in
 * openapi.yaml. razorpay-gateway.service.ts is the one file that should
 * change if the vendor is ever swapped out; nothing else in the app
 * (CareModule's AppointmentsService, webhook controllers and background
 * workers) talks to Razorpay directly. CareModule creates orders and
 * durably queues refunds; workers submit and reconcile them after commit.
 */
@Module({
  imports: [NotificationsModule],
  controllers: [PaymentsWebhookController],
  providers: [RazorpayGatewayService, PaymentsWebhookService, RefundsService, RefundDeliveryService, PaymentExpiryService, PaymentReconciliationService],
  exports: [RazorpayGatewayService, RefundsService],
})
export class PaymentsModule {}
