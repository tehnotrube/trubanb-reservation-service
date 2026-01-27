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

  // ============================================================================
  // RESERVATION REQUESTS - Guest endpoints
  // ============================================================================

  @Post('requests')
  @UseGuards(auth.KongJwtGuard, auth.RolesGuard)
  @auth.Roles(auth.UserRole.GUEST)
  @ApiOperation({ summary: 'Create a new reservation request' })
  @ApiResponse({
    status: 201,
    description: 'Request created',
    type: ReservationRequestResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or dates already reserved',
  })
  async createRequest(
    @Body() dto: CreateReservationRequestDto,
    @auth.CurrentUser() user: auth.AuthenticatedUser,
  ): Promise<ReservationRequestResponseDto> {
    const request = await this.reservationsService.createRequest(dto, user.id);
    return plainToInstance(ReservationRequestResponseDto, request, {
      excludeExtraneousValues: true,
    });
  }

  @Get('requests')
  @UseGuards(auth.KongJwtGuard, auth.RolesGuard)
  @auth.Roles(auth.UserRole.GUEST)
  @ApiOperation({ summary: 'Get all my reservation requests' })
  @ApiResponse({
    status: 200,
    description: 'List of requests',
    type: [ReservationRequestResponseDto],
  })
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
  @ApiOperation({ summary: 'Get a reservation request by ID' })
  @ApiResponse({
    status: 200,
    description: 'Request details',
    type: ReservationRequestResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Request not found' })
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
  @ApiOperation({ summary: 'Cancel a pending reservation request' })
  @ApiResponse({
    status: 200,
    description: 'Request cancelled',
    type: ReservationRequestResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Request is not pending' })
  @ApiResponse({ status: 403, description: 'Not your request' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async cancelRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @auth.CurrentUser() user: auth.AuthenticatedUser,
  ): Promise<ReservationRequestResponseDto> {
    const request = await this.reservationsService.cancelRequest(id, user.id);
    return plainToInstance(ReservationRequestResponseDto, request, {
      excludeExtraneousValues: true,
    });
  }

  // ============================================================================
  // RESERVATION REQUESTS - Host endpoints
  // ============================================================================

  @Get('requests/pending/:accommodationId')
  @UseGuards(auth.KongJwtGuard, auth.RolesGuard)
  @auth.Roles(auth.UserRole.HOST, auth.UserRole.ADMIN)
  @ApiOperation({ summary: 'Get pending requests for an accommodation' })
  @ApiResponse({
    status: 200,
    description: 'List of pending requests',
    type: [ReservationRequestResponseDto],
  })
  async getPendingRequests(
    @Param('accommodationId', ParseUUIDPipe) accommodationId: string,
  ): Promise<ReservationRequestResponseDto[]> {
    // TODO: Verify user owns this accommodation
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
  @ApiOperation({ summary: 'Approve a reservation request' })
  @ApiResponse({
    status: 200,
    description: 'Request approved, reservation created',
  })
  @ApiResponse({
    status: 400,
    description: 'Request not pending or dates conflict',
  })
  @ApiResponse({ status: 404, description: 'Request not found' })
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
  @ApiOperation({ summary: 'Reject a reservation request' })
  @ApiResponse({
    status: 200,
    description: 'Request rejected',
    type: ReservationRequestResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Request not pending' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async rejectRequest(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ReservationRequestResponseDto> {
    const request = await this.reservationsService.rejectRequest(id);
    return plainToInstance(ReservationRequestResponseDto, request, {
      excludeExtraneousValues: true,
    });
  }

  // ============================================================================
  // RESERVATIONS - Read endpoints
  // ============================================================================

  @Get()
  @UseGuards(auth.KongJwtGuard, auth.RolesGuard)
  @auth.Roles(auth.UserRole.GUEST)
  @ApiOperation({ summary: 'Get all my reservations' })
  @ApiResponse({
    status: 200,
    description: 'List of reservations',
    type: [ReservationResponseDto],
  })
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
  @ApiOperation({ summary: 'Get a reservation by ID' })
  @ApiResponse({
    status: 200,
    description: 'Reservation details',
    type: ReservationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Reservation not found' })
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
