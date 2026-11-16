import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Req,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommunityService } from './community.service';
import { JwtService } from '@nestjs/jwt';

@ApiTags('community')
@Controller('community')
export class CommunityController {
  constructor(
    private readonly communityService: CommunityService,
    private readonly jwtService: JwtService,
  ) {}

  private extractUserFromReq(req: any): { userId: string | null; email: string | null } {
    let userId: string | null = null;
    let email: string | null = null;

    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const payload = this.jwtService.decode(token) as any;
        if (payload) {
          userId = payload.sub || payload.userId || payload.id || null;
          email = payload.email || null;
        }
      } catch (e) {
        // decode error
      }
    }
    return { userId, email };
  }

  // 1. Hämta alla språkforum med meddelanderäknare och aktivitet
  @ApiOperation({ summary: 'Get list of language chat rooms with statistics' })
  @Get('rooms')
  async getRooms() {
    const rooms = await this.communityService.getRooms();
    return {
      success: true,
      rooms,
    };
  }

  // 2. Hämta meddelanden för ett specifikt språk
  @ApiOperation({ summary: 'Get messages for a language chat room' })
  @Get('messages')
  async getMessages(
    @Query('language') language?: string,
    @Query('topic') topic?: string,
  ) {
    return await this.communityService.getMessages(language || 'sv', topic);
  }

  // 3. Skicka ett meddelande i ett språkforum
  @ApiOperation({ summary: 'Post a new message in a language chat room' })
  @ApiBearerAuth()
  @Post('messages')
  async postMessage(
    @Req() req: any,
    @Body()
    body: {
      language: string;
      message: string;
      topic?: string;
      userName?: string;
      parentId?: string;
    },
  ) {
    const { userId, email } = this.extractUserFromReq(req);

    return await this.communityService.postMessage({
      userId: userId || undefined,
      userEmail: email || undefined,
      userName: body.userName,
      language: body.language || 'sv',
      message: body.message,
      topic: body.topic || 'Allmänt',
      parentId: body.parentId,
    });
  }

  // 4. Gilla / rösta upp ett meddelande
  @ApiOperation({ summary: 'Like a community message' })
  @Post('messages/:id/like')
  async likeMessage(@Param('id') id: string) {
    return await this.communityService.likeMessage(id);
  }
}
