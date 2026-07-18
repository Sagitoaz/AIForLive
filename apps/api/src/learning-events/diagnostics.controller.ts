import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("diagnostics")
@Controller("diagnostics")
export class DiagnosticsController {
  @Post("start")
  start(): Record<string, unknown> {
    return {
      id: randomUUID(),
      status: "IN_PROGRESS",
      questions: [
        { id: "diag-1", conceptCode: "PYTHON_VARIABLES", prompt: "Giá trị của x sau x = 3 là gì?", options: ["3", "x", "0"] },
        { id: "diag-2", conceptCode: "PYTHON_RANGE", prompt: "range(1, 5) tạo dãy nào?", options: ["1,2,3,4", "1,2,3,4,5", "0,1,2,3,4"] },
        { id: "diag-3", conceptCode: "PYTHON_LISTS", prompt: "Index đầu tiên của list?", options: ["0", "1", "-1"] }
      ]
    };
  }

  @Post(":id/answer")
  answer(@Param("id") id: string, @Body() body: Record<string, unknown>): Record<string, unknown> {
    return { diagnosticId: id, accepted: true, answer: body, remaining: 2 };
  }

  @Post(":id/complete")
  complete(@Param("id") id: string): Record<string, unknown> {
    return { diagnosticId: id, status: "COMPLETED", initialMastery: { PYTHON_VARIABLES: 0.72, PYTHON_RANGE: 0.42, PYTHON_LISTS: 0.55 } };
  }

  @Get(":id/result")
  result(@Param("id") id: string): Record<string, unknown> {
    return { diagnosticId: id, strongest: "PYTHON_VARIABLES", focus: ["PYTHON_RANGE", "PYTHON_WHILE"], pathVersion: "path-v1" };
  }
}
