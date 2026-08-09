import type {
  MediaGenerateImageParams,
  MediaGenerateVideoParams,
  MediaJobStatusResult,
  MediaProviderCapabilities,
  MediaProviderName,
  VideoGenerationMode,
} from '@aura/types';

export interface MediaSubmitResult {
  providerJobId: string;
  status: 'queued' | 'processing';
}

export interface IMediaGenerationProvider {
  readonly name: MediaProviderName;
  capabilities(): MediaProviderCapabilities;
  isConfigured(): boolean;
  supportsMode(mode: VideoGenerationMode): boolean;
  generateVideo(params: MediaGenerateVideoParams): Promise<MediaSubmitResult>;
  generateImage?(params: MediaGenerateImageParams): Promise<MediaSubmitResult>;
  getJobStatus(providerJobId: string): Promise<MediaJobStatusResult>;
  cancelJob?(providerJobId: string): Promise<boolean>;
}
