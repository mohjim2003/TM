import { Controller, Get, InternalServerErrorException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Controller('api/questions')
export class QuestionsController {
  @Get()
  getQuestions() {
    try {
      // Hittar din questionData.json i backend-mappen
      const filePath = path.resolve(process.cwd(), 'questionData.json');
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      
      // Skickar tillbaka alla frågor (både gamla och nattens nya AI-frågor!)
      return JSON.parse(fileContent);
    } catch (error) {
      throw new InternalServerErrorException('Kunde inte läsa frågedatabasen.');
    }
  }
}