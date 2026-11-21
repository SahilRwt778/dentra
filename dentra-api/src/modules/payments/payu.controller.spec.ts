import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PG_POOL } from '@database/database.module';
import { PaymentCheckoutService } from './payment-checkout.service';
import { PaymentReconciliationService } from './payment-reconciliation.service';
import { PayuGatewayService } from './payu-gateway.service';
import { RefundsService } from './refunds.service';
import { PayuController } from './payu.controller';

const transactionId = '0123456789abcdef01234567';
const verifyResponse = jest.fn();
const query = jest.fn();
const reconcileOrder = jest.fn();
let controller: PayuController;

beforeEach(async () => {
  verifyResponse.mockReset().mockReturnValue(true);
  query.mockReset().mockResolvedValue({ rows: [{ id: 'saved-payment' }] });
  reconcileOrder.mockReset().mockResolvedValue(undefined);
  const module = await Test.createTestingModule({
    controllers: [PayuController],
    providers: [
      { provide: PaymentCheckoutService, useValue: {} },
      { provide: PayuGatewayService, useValue: { verifyResponse } },
      { provide: PaymentReconciliationService, useValue: { reconcileOrder } },
      { provide: RefundsService, useValue: {} },
      { provide: PG_POOL, useValue: { query } },
    ],
  }).compile();
  controller = module.get(PayuController);
});

test.each(['success', 'failure'])('a verified %s callback returns the native checkout bridge', async status => {
  const html = await controller.callback({ txnid: transactionId, status });
  expect(reconcileOrder).toHaveBeenCalledWith(transactionId, 'payu');
  expect(html).toContain(status === 'success' ? 'window.PayU.onSuccess(response)' : 'window.PayU.onFailure(response)');
  expect(html).toContain('observer.postMessage');
});

test('an invalid reverse hash cannot emit a checkout completion callback', async () => {
  verifyResponse.mockReturnValue(false);
  await expect(controller.callback({ txnid: transactionId, status: 'success' }))
    .rejects.toBeInstanceOf(BadRequestException);
  expect(query).not.toHaveBeenCalled();
  expect(reconcileOrder).not.toHaveBeenCalled();
});

test('a malformed transaction ID cannot reach the callback page', async () => {
  await expect(controller.callback({ txnid: '<script>', status: 'success' }))
    .rejects.toBeInstanceOf(BadRequestException);
  expect(query).not.toHaveBeenCalled();
});

test('the page does not reflect customer or card fields from the posted response', async () => {
  const html = await controller.callback({
    txnid: transactionId,
    status: 'success',
    firstname: 'Private patient',
    email: 'patient@example.test',
    cardnum: 'redacted-card',
  });
  expect(html).not.toContain('Private patient');
  expect(html).not.toContain('patient@example.test');
  expect(html).not.toContain('redacted-card');
});
