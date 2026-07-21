import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CreateContactSubmissionDto } from './dto/create-contact-submission.dto';
import {
  ContactSubmissionDto,
  ContactSubmissionListItemDto,
  CreateContactSubmissionResponseDto,
} from './dto/contact-submission.dto';
import { PaginatedResponse } from '@jazz-portfolio/shared';
import { normalizePagination, paginatedResponse } from '../common/pagination';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async createSubmission(dto: CreateContactSubmissionDto): Promise<CreateContactSubmissionResponseDto> {
    if (!this.mailService.isConfigured) {
      throw new ServiceUnavailableException('Email notification service is not configured.');
    }

    const submission = await this.prisma.contactSubmission.create({
      data: {
        senderName: dto.name,
        senderEmail: dto.email,
        subject: dto.subject,
        messageBody: dto.message,
      },
    });

    // Fire-and-forget: do not block 201 on SMTP latency/failures
    void this.mailService
      .sendContactNotification({
        senderName: submission.senderName,
        senderEmail: submission.senderEmail,
        subject: submission.subject,
        messageBody: submission.messageBody,
        createdAt: submission.createdAt,
      })
      .catch((err) => {
        this.logger.warn(
          `Contact notification email failed for submission ${submission.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });

    return {
      id: submission.id,
      createdAt: submission.createdAt.toISOString(),
      emailDelivered: true,
    };
  }

  async listSubmissions(
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<ContactSubmissionListItemDto>> {
    const { page: safePage, limit: safeLimit, skip } = normalizePagination(page, limit);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.contactSubmission.findMany({
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          senderName: true,
          senderEmail: true,
          subject: true,
          isRead: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.contactSubmission.count(),
    ]);

    const items = rows.map((sub) => ({
      id: sub.id,
      senderName: sub.senderName,
      senderEmail: sub.senderEmail,
      subject: sub.subject,
      isRead: sub.isRead,
      createdAt: sub.createdAt.toISOString(),
      updatedAt: sub.updatedAt.toISOString(),
    }));

    return paginatedResponse(items, total, safePage, safeLimit);
  }

  async getSubmissionById(id: string): Promise<ContactSubmissionDto> {
    const sub = await this.prisma.contactSubmission.findUnique({ where: { id } });
    if (!sub) {
      throw new NotFoundException(`Contact submission with ID "${id}" not found.`);
    }

    return {
      id: sub.id,
      senderName: sub.senderName,
      senderEmail: sub.senderEmail,
      subject: sub.subject,
      messageBody: sub.messageBody,
      isRead: sub.isRead,
      createdAt: sub.createdAt.toISOString(),
      updatedAt: sub.updatedAt.toISOString(),
    };
  }

  async markAsRead(id: string): Promise<ContactSubmissionDto> {
    try {
      const sub = await this.prisma.contactSubmission.update({
        where: { id },
        data: { isRead: true },
      });

      return {
        id: sub.id,
        senderName: sub.senderName,
        senderEmail: sub.senderEmail,
        subject: sub.subject,
        messageBody: sub.messageBody,
        isRead: sub.isRead,
        createdAt: sub.createdAt.toISOString(),
        updatedAt: sub.updatedAt.toISOString(),
      };
    } catch {
      throw new NotFoundException(`Contact submission with ID "${id}" not found.`);
    }
  }
}
