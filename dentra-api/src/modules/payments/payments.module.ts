import { Module } from '@nestjs/common';
import { PayuGatewayService } from './payu-gateway.service';
import { PaymentGatewayService } from './payment-gateway.service';
import { PaymentCheckoutService } from './payment-checkout.service';
import { PayuController } from './payu.controller';
import { RazorpayGatewayService } from './razorpay-gateway.service';
import { PaymentsWebhookController } from './payments-webhook.controller';
import { PaymentsWebhookService } from './payments-webhook.service';
import { RefundsService } from './refunds.service';
import { RefundDeliveryService } from './refund-delivery.service';
import { PaymentExpiryService } from './payment-expiry.service';
import { PaymentReconciliationService } from './payment-reconciliation.service';
import { NotificationsModule } from '@modules/notifications/notifications.module';

/** Payment providers, server verification and durable refund delivery. */
@Module({
  imports: [NotificationsModule],
  controllers: [PaymentsWebhookController, PayuController],
  providers: [PayuGatewayService, PaymentGatewayService, PaymentCheckoutService, RazorpayGatewayService, PaymentsWebhookService, RefundsService, RefundDeliveryService, PaymentExpiryService, PaymentReconciliationService],
  exports: [PaymentGatewayService, PayuGatewayService, RazorpayGatewayService, RefundsService, PaymentReconciliationService],
})
export class PaymentsModule {}
