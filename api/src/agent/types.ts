export type ChannelType = 'telegram' | 'whatsapp' | 'web' | 'voice_call';
export type ModalityType = 'text' | 'voice' | 'image' | 'braille';

export interface AgentInput {
    userId: string;
    channel: ChannelType;
    modality: ModalityType;
    payload: {
        text?: string;
        audioBuffer?: Buffer;
        imageUrl?: string;
        brailleText?: string;
    };
    metadata?: Record<string, any>;
}

export interface AgentResponse {
    text?: string;
    audioBuffer?: Buffer;
    imageUrl?: string;
    brailleText?: string;
    action?: 'quiz' | 'lesson' | 'chat';
    metadata?: Record<string, any>;
}
