import { SetMetadata } from '@nestjs/common';

export type FeatureKey = 'blog' | 'comments' | 'contact';

export interface FeatureMeta {
  feature: FeatureKey;
  notFoundWhenOff: boolean;
}

export const FEATURE_KEY = 'requiredFeature';

export const RequireFeature = (
  feature: FeatureKey,
  opts?: { notFoundWhenOff?: boolean },
) =>
  SetMetadata(FEATURE_KEY, {
    feature,
    notFoundWhenOff: opts?.notFoundWhenOff ?? false,
  } satisfies FeatureMeta);
