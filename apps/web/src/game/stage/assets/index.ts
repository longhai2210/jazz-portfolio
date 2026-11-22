/**
 * Stage assets: the manifest of `/game-assets/` and a loader that reports progress in real bytes.
 * Test helpers live in `./testing` and are not exported here.
 */
export {
  ASSET_BASE_URL,
  MANIFEST_URL,
  MANIFEST_VERSION,
  fetchManifest,
  parseManifest,
  type FetchManifestOptions,
  type ManifestResult,
  type StageManifest,
} from './manifest';
export {
  assetFiles,
  assetLoadProgress,
  loadAssetFiles,
  loadStageAssets,
  totalManifestBytes,
  type AssetFile,
  type AssetFileId,
  type AssetFilesResult,
  type AssetLoadProgress,
  type LoadAssetFilesOptions,
  type StageAssetFiles,
  type StageAssetsResult,
} from './loader';
export type { FetchLike, MissingAssets, MissingAssetsReason, ResponseLike } from './types';
