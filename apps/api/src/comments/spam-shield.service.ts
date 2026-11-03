import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlocklistType } from '@jazz-portfolio/shared';

export interface SpamEvaluationResult {
  isBlocked: boolean;
  blockReason?: string;
  spamScore: number;
  flaggedForReview: boolean;
}

@Injectable()
export class SpamShieldService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluateComment(params: {
    authorName: string;
    authorEmail: string;
    content: string;
    ipAddress: string;
    maxLinks: number;
    spamThresholdScore: number;
  }): Promise<SpamEvaluationResult> {
    const {
      authorName,
      authorEmail,
      content,
      ipAddress,
      maxLinks,
      spamThresholdScore,
    } = params;

    // 1. Fetch active blocklist rules
    const blocklist = await this.prisma.commentBlocklist.findMany();


    const lowerContent = content.toLowerCase();
    const lowerName = authorName.toLowerCase();
    const lowerEmail = authorEmail.toLowerCase();

    for (const rule of blocklist) {
      const targetVal = rule.value.toLowerCase();

      switch (rule.type) {
        case BlocklistType.KEYWORD:
          if (lowerContent.includes(targetVal) || lowerName.includes(targetVal)) {
            return {
              isBlocked: true,
              blockReason: `Matched blocklist keyword: "${rule.value}"`,
              spamScore: 100,
              flaggedForReview: true,
            };
          }
          break;

        case BlocklistType.EMAIL:
          if (lowerEmail === targetVal) {
            return {
              isBlocked: true,
              blockReason: `Matched blocklist email: "${rule.value}"`,
              spamScore: 100,
              flaggedForReview: true,
            };
          }
          break;

        case BlocklistType.EMAIL_DOMAIN:
          if (lowerEmail.endsWith(`@${targetVal}`) || lowerContent.includes(targetVal)) {
            return {
              isBlocked: true,
              blockReason: `Matched blocklist email domain: "${rule.value}"`,
              spamScore: 100,
              flaggedForReview: true,
            };
          }
          break;

        case BlocklistType.IP_HASH:
          if (ipAddress === rule.value) {
            return {
              isBlocked: true,
              blockReason: `Matched blocklist IP/Hash: "${rule.value}"`,
              spamScore: 100,
              flaggedForReview: true,
            };
          }
          break;
      }
    }


    // 2. Heuristic Spam Score Calculation
    let spamScore = 0;

    // Link count check
    const linkMatches = content.match(/https?:\/\/[^\s]+/gi) || [];
    if (linkMatches.length > maxLinks) {
      spamScore += 35;
    }

    // ALL CAPS check
    const alphaChars = content.replace(/[^a-zA-Z]/g, '');
    if (alphaChars.length > 15) {
      const upperChars = content.replace(/[^A-Z]/g, '').length;
      if (upperChars / alphaChars.length > 0.7) {
        spamScore += 25;
      }
    }

    // Repeated symbols or letters
    if (/(.)\1{4,}/.test(content)) {
      spamScore += 15;
    }

    // Common spam phrases
    const spamKeywords = [
      'casino',
      'viagra',
      'free money',
      'crypto giveaway',
      'bit.ly',
      'telegram:',
      'whatsapp:',
      'click here',
      'cheap price',
    ];
    for (const kw of spamKeywords) {
      if (lowerContent.includes(kw)) {
        spamScore += 20;
      }
    }

    const flaggedForReview =
      spamScore >= spamThresholdScore || linkMatches.length > maxLinks;

    return {
      isBlocked: false,
      spamScore,
      flaggedForReview,
    };
  }
}
