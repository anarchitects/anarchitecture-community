import { customer } from '@app/customer';
import { orderService } from '@app/order/service';
import { shared } from '@shared/index';
import { sharedBase } from 'shared-base/src/index';

export const web = customer && orderService && shared && sharedBase;
