import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ReservationsService } from './reservations.service';
import {
  CreateReservationRequestDto,
  ReservationRequestResponseDto,
  ReservationResponseDto,
} from './dto';
import * as auth from '../auth';
import { plainToInstance } from 'class-transformer';

@ApiTags('Reservations')
@ApiBearerAuth()
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post('requests')
  @UseGuards(auth.KongJwtGuard, auth.RolesGuard)
  @auth.Roles(auth.UserRole.GUEST)
  @ApiOperation({ summary: 'Create a new reservation request' })
  @ApiResponse({
    status: 201,
    description: 'Request created (and potentially auto-approved)',
  })
  async createRequest(
    @Body() dto: CreateReservationRequestDto,
    @auth.CurrentUser() user: auth.AuthenticatedUser,
  ): Promise<{
    request: ReservationRequestResponseDto;
    reservation?: ReservationResponseDto;
  }> {
    const result = await this.reservationsService.createRequest(dto, user.id);

    // We must map the inner objects specifically because 'result' is a wrapper
    return {
      request: plainToInstance(ReservationRequestResponseDto, result.request, {
        excludeExtraneousValues: true,
      }),
      reservation: result.reservation
        ? plainToInstance(ReservationResponseDto, result.reservation, {
            excludeExtraneousValues: true,
          })
        : undefined,
    };
  }

  @Get('requests')
  @UseGuards(auth.KongJwtGuard, auth.RolesGuard)
  @auth.Roles(auth.UserRole.GUEST)
  @ApiOperation({ summary: 'Get all my reservation requests' })
  async getMyRequests(
    @auth.CurrentUser() user: auth.AuthenticatedUser,
  ): Promise<ReservationRequestResponseDto[]> {
    const requests = await this.reservationsService.getRequestsByGuest(user.id);
    return requests.map((r) =>
      plainToInstance(ReservationRequestResponseDto, r, {
        excludeExtraneousValues: true,
      }),
    );
  }

  @Get('requests/:id')
  @UseGuards(auth.KongJwtGuard)
  async getRequestById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ReservationRequestResponseDto> {
    const request = await this.reservationsService.getRequestById(id);
    return plainToInstance(ReservationRequestResponseDto, request, {
      excludeExtraneousValues: true,
    });
  }

  @Delete('requests/:id')
  @UseGuards(auth.KongJwtGuard, auth.RolesGuard)
  @auth.Roles(auth.UserRole.GUEST)
  async cancelRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @auth.CurrentUser() user: auth.AuthenticatedUser,
  ): Promise<ReservationRequestResponseDto> {
    const request = await this.reservationsService.cancelRequest(id, user.id);
    return plainToInstance(ReservationRequestResponseDto, request, {
      excludeExtraneousValues: true,
    });
  }

  @Get('requests/pending/:accommodationId')
  @UseGuards(auth.KongJwtGuard, auth.RolesGuard)
  @auth.Roles(auth.UserRole.HOST, auth.UserRole.ADMIN)
  async getPendingRequests(
    @Param('accommodationId', ParseUUIDPipe) accommodationId: string,
  ): Promise<ReservationRequestResponseDto[]> {
    const requests =
      await this.reservationsService.getPendingRequestsForAccommodation(
        accommodationId,
      );
    return requests.map((r) =>
      plainToInstance(ReservationRequestResponseDto, r, {
        excludeExtraneousValues: true,
      }),
    );
  }

  @Put('requests/:id/approve')
  @UseGuards(auth.KongJwtGuard, auth.RolesGuard)
  @auth.Roles(auth.UserRole.HOST, auth.UserRole.ADMIN)
  async approveRequest(@Param('id', ParseUUIDPipe) id: string): Promise<{
    request: ReservationRequestResponseDto;
    reservation: ReservationResponseDto;
  }> {
    const result = await this.reservationsService.approveRequest(id);
    return {
      request: plainToInstance(ReservationRequestResponseDto, result.request, {
        excludeExtraneousValues: true,
      }),
      reservation: plainToInstance(ReservationResponseDto, result.reservation, {
        excludeExtraneousValues: true,
      }),
    };
  }

  @Put('requests/:id/reject')
  @UseGuards(auth.KongJwtGuard, auth.RolesGuard)
  @auth.Roles(auth.UserRole.HOST, auth.UserRole.ADMIN)
  async rejectRequest(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ReservationRequestResponseDto> {
    const request = await this.reservationsService.rejectRequest(id);
    return plainToInstance(ReservationRequestResponseDto, request, {
      excludeExtraneousValues: true,
    });
  }

  @Get()
  @UseGuards(auth.KongJwtGuard, auth.RolesGuard)
  @auth.Roles(auth.UserRole.GUEST)
  async getMyReservations(
    @auth.CurrentUser() user: auth.AuthenticatedUser,
  ): Promise<ReservationResponseDto[]> {
    const reservations = await this.reservationsService.getReservationsByGuest(
      user.id,
    );
    return reservations.map((r) =>
      plainToInstance(ReservationResponseDto, r, {
        excludeExtraneousValues: true,
      }),
    );
  }

  @Get(':id')
  @UseGuards(auth.KongJwtGuard)
  async getReservationById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ReservationResponseDto> {
    const reservation = await this.reservationsService.getReservationById(id);
    return plainToInstance(ReservationResponseDto, reservation, {
      excludeExtraneousValues: true,
    });
  }

  @Post('blocks')
  @UseGuards(auth.KongJwtGuard, auth.RolesGuard)
  @auth.Roles(auth.UserRole.HOST)
  async createBlock(
    @Body()
    dto: { accommodationId: string; startDate: string; endDate: string },
    @auth.CurrentUser() user: auth.AuthenticatedUser,
  ): Promise<ReservationResponseDto> {
    const block = await this.reservationsService.createManualBlock(
      dto.accommodationId,
      new Date(dto.startDate),
      new Date(dto.endDate),
      user.id,
    );
    return plainToInstance(ReservationResponseDto, block, {
      excludeExtraneousValues: true,
    });
  }

  @Delete('blocks/:id')
  @UseGuards(auth.KongJwtGuard, auth.RolesGuard)
  @auth.Roles(auth.UserRole.HOST)
  async removeBlock(
    @Param('id', ParseUUIDPipe) id: string,
    @auth.CurrentUser() user: auth.AuthenticatedUser,
  ) {
    await this.reservationsService.removeManualBlock(id, user.id);
    return { success: true };
  }
}
