import { create } from 'zustand';
import { NODE_COUNT_MAP } from '@/lib/models';
import type { ApolloTier, ModelFamily } from '@/lib/models';

interface PredictedEngagement {
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  views: number;
}

interface SimulationStore {
  modelFamily: ModelFamily;
  apolloTier: ApolloTier;
  nodeCount: 300 | 1000 | 10000;
  setApolloTier: (tier: ApolloTier) => void;
  setModelFamily: (family: ModelFamily) => void;
  videoSrc: string | null;
  thumbnailSrc: string | null;
  setVideoSrc: (src: string | null) => void;
  setThumbnailSrc: (src: string | null) => void;
  analysisStatus: 'idle' | 'loading' | 'complete' | 'error';
  predictedEngagement: PredictedEngagement | null;
  setAnalysisStatus: (status: 'idle' | 'loading' | 'complete' | 'error') => void;
  setAnalysisResult: (engagement: PredictedEngagement) => void;
  resetAnalysis: () => void;
}

export const useSimulationStore = create<SimulationStore>((set) => ({
  modelFamily: 'apollo',
  apolloTier: 'pro',
  nodeCount: 1000,
  setApolloTier: (tier) => set({ apolloTier: tier, nodeCount: NODE_COUNT_MAP[tier] }),
  setModelFamily: (family) => set({ modelFamily: family }),
  videoSrc: null,
  thumbnailSrc: null,
  setVideoSrc: (src) => set((state) => {
    if (state.videoSrc?.startsWith('blob:')) URL.revokeObjectURL(state.videoSrc);
    return { videoSrc: src };
  }),
  setThumbnailSrc: (src) => set({ thumbnailSrc: src }),
  analysisStatus: 'idle',
  predictedEngagement: null,
  setAnalysisStatus: (status) => set({ analysisStatus: status }),
  setAnalysisResult: (engagement) => set({ predictedEngagement: engagement, analysisStatus: 'complete' }),
  resetAnalysis: () => set({
    videoSrc: null,
    thumbnailSrc: null,
    analysisStatus: 'idle',
    predictedEngagement: null,
  }),
}));
