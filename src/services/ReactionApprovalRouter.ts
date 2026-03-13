import { Message } from 'discord.js';

export interface ReactionApprovalContext {
  channelId: string;
  parentId: string | null;
  messageId: string;
  message: Message;
}

export interface ReactionHandler {
  matches(context: ReactionApprovalContext): boolean;
  approve(context: ReactionApprovalContext, staffIdentifier: string): Promise<boolean>;
}

export class ReactionApprovalRouter {
  private handlers: ReactionHandler[] = [];

  register(handler: ReactionHandler): void {
    this.handlers.push(handler);
  }

  async route(context: ReactionApprovalContext, staffIdentifier: string): Promise<boolean> {
    for (const handler of this.handlers) {
      if (handler.matches(context)) {
        try {
          return await handler.approve(context, staffIdentifier);
        } catch (error) {
          console.error('Error in reaction approval handler:', error);
          return false;
        }
      }
    }
    return false;
  }
}
