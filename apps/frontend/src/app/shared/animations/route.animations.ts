import {
  trigger,
  transition,
  style,
  animate,
  query,
  group,
} from '@angular/animations';

export const routeAnimations = trigger('routeAnimations', [
  transition('* <=> *', [
    query(':enter, :leave', [
      style({ position: 'absolute', width: '100%', top: 0 }),
    ], { optional: true }),
    group([
      query(':leave', [
        animate('180ms ease-in', style({ opacity: 0, transform: 'translateY(8px)' })),
      ], { optional: true }),
      query(':enter', [
        style({ opacity: 0, transform: 'translateY(12px)' }),
        animate('220ms 100ms ease-out', style({ opacity: 1 })),
      ], { optional: true }),
    ]),
  ]),
]);
