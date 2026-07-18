import { Body, Controller, HttpCode, HttpStatus, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { SynthesizeSpeechDto } from "./dto/synthesize-speech.dto";
import { TtsService } from "./tts.service";

@Controller("tts")
export class TtsController {
  constructor(private readonly ttsService: TtsService) {}

  @Post("speech")
  @HttpCode(HttpStatus.OK)
  async synthesize(@Body() input: SynthesizeSpeechDto, @Res() response: Response): Promise<void> {
    const clip = await this.ttsService.synthesize(input.text);
    response.setHeader("Content-Type", clip.contentType);
    response.setHeader("Content-Length", String(clip.audio.length));
    response.setHeader("Cache-Control", "private, max-age=3600");
    response.setHeader("X-TTS-Provider", "FPT.AI-VITs");
    response.setHeader("X-TTS-Cache", clip.cacheHit ? "HIT" : "MISS");
    response.send(clip.audio);
  }
}
