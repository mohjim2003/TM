import { Controller, Post, Get, Body, Req, Query } from '@nestjs/common';
import { FeedbackService } from './feedback.service';

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  async submitFeedback(@Body() body: any, @Req() req: any) {
    const userId = body.userId || req.user?.sub || req.user?.userId;
    return this.feedbackService.createFeedback({
      userId,
      name: body.name,
      email: body.email,
      rating: body.rating,
      category: body.category,
      message: body.message,
    });
  }

  @Get()
  async getAllFeedback(@Query('limit') limit?: string) {
    return this.feedbackService.getAllFeedback(limit ? Number(limit) : 20);
  }

  @Get('stats')
  async getLiveStats() {
    return this.feedbackService.getLiveStats();
  }
}
