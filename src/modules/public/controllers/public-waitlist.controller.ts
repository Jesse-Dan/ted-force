import { Request } from "express";
import {
  Autowired,
  Body,
  Controller,
  Post,
  RequestContext,
  Res,
  Response,
} from "fragment-ts";
import { RequestContextHolder } from "../../../common/context/request-context-holder";
import { UseRequestContextPipeline } from "../../../common/decorators/use-request-context-pipeline.decorator";
import type { WaitlistRequestContext } from "../../../entities/waitlist-entry.entity";
import { CreateWaitlistEntryDto } from "../dto/create-waitlist-entry.dto";
import { PublicService } from "../services/public.service";

@UseRequestContextPipeline()
@Controller("/public/waitlist")
export class PublicWaitlistController {
  @Autowired()
  private publicService!: PublicService;

  @RequestContext()
  private req!: Request;

  @Post()
  async create(@Body() body: CreateWaitlistEntryDto, @Res() response: Response) {
    await this.publicService.submitWaitlistWithSse(
      body,
      this.resolveRequestContext(),
      response,
    );
    return response;
  }

  private resolveRequestContext(): WaitlistRequestContext {
    const context = RequestContextHolder.get();

    return {
      ip: context?.ip ?? this.req.ip,
      userAgent: this.readHeader("user-agent"),
      referrer: this.readHeader("referer"),
      origin: this.readHeader("origin"),
      pathname: this.req.path,
      headers: {
        ...this.resolveHeaders(),
        "x-request-id": context?.requestId,
        "x-session-id": context?.sessionId,
        "x-conversation-id": context?.conversationId,
      },
    };
  }

  private readHeader(name: string): string | undefined {
    const value = this.req.headers[name];

    if (Array.isArray(value)) {
      return value[0];
    }

    return value;
  }

  private resolveHeaders(): Record<string, string | string[] | undefined> {
    const headers: Record<string, string | string[] | undefined> = {};

    for (const [key, value] of Object.entries(this.req.headers)) {
      headers[key] = value;
    }

    return headers;
  }
}
