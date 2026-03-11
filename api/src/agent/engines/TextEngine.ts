import { AgentInput, AgentResponse } from '../types.js';

export class TextEngine {
    async processInput(input: AgentInput): Promise<string> {
        if (!input.payload.text) throw new Error("No text provided to TextEngine");
        return input.payload.text;
    }

    async generateResponse(prompt: string, context: any): Promise<AgentResponse> {
        // Here we will call Gemini 2.0 Flash to generate the actual conversational text response
        // For now, this is a skeleton
        return {
            text: `(TextEngine Response) I received your query about: ${prompt}`,
            action: 'chat'
        };
    }
}
