import { AgentInput, AgentResponse, ChannelType } from './types.js';
import { TextEngine } from './engines/TextEngine.js';
import { VoiceEngine } from './engines/VoiceEngine.js';
import { BrailleEngine } from './engines/BrailleEngine.js';
import { VisualEngine } from './engines/VisualEngine.js';
import { LearningEngine } from './LearningEngine.js';

export class AgentHub {
    private textEngine = new TextEngine();
    private voiceEngine = new VoiceEngine();
    private brailleEngine = new BrailleEngine();
    private visualEngine = new VisualEngine();
    private learningEngine = new LearningEngine();

    /**
     * Primary entry point for all channels (Telegram, Web, WhatsApp, etc.)
     */
    async processInteraction(input: AgentInput): Promise<AgentResponse> {
        console.log(`[AgentHub] Received interaction from User: ${input.userId} on Channel: ${input.channel} with Modality: ${input.modality}`);

        let interpretedText = "";

        // 1. Transduce input modality into common text/intent format
        try {
            switch (input.modality) {
                case 'text':
                    interpretedText = await this.textEngine.processInput(input);
                    break;
                case 'voice':
                    interpretedText = await this.voiceEngine.processInput(input);
                    break;
                case 'braille':
                    interpretedText = await this.brailleEngine.processInput(input);
                    break;
                case 'image':
                    interpretedText = await this.visualEngine.processInput(input);
                    break;
                default:
                    throw new Error(`Unsupported input modality: ${input.modality}`);
            }
        } catch (error) {
            console.error(`[AgentHub] Error processing input modality ${input.modality}:`, error);
            interpretedText = "Error processing input.";
        }

        // 2. Core Learning Engine decides the pedagogical outcome
        const coreResponse = await this.learningEngine.determineNextAction(input.userId, interpretedText);

        // 3. Format transducer (Translate core outcome back to requested channel limits/modalities)
        // For simplicity now, we just return the core response. 
        // In reality, this would map the coreResponse back to audio bytes, braille, or images based on the user's preferred modality.

        return coreResponse;
    }
}

// Export a singleton instance for global use
export const agentHub = new AgentHub();
