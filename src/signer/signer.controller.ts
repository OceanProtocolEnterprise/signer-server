import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  ParseIntPipe,
  ForbiddenException,
} from '@nestjs/common';
import { Req } from '@nestjs/common';
import { SignerService } from './signer.service';
import { SignMessageDto } from './dto/sign-message.dto';
import { SendTransactionDto } from './dto/send-transaction.dto';
import { AuthentikGuard } from '../common/guards/authentik.guard';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ethers } from 'ethers';
import { Request } from 'express';
import {
  AddressResponse,
  SignMessageResponse,
  SendTransactionResult,
  SendTransactionResponse,
  TransactionResponse,
  NonceResponse,
  AvailableNetworksResponse,
} from './interfaces/signer-responses.interface';
import { Public } from '../common/decorators/public.decorator';

type AuthenticatedRequest = Request & {
  user?: {
    walletId?: unknown;
  };
};

@ApiTags('signer')
@Controller()
@UseGuards(AuthentikGuard)
@ApiBearerAuth()
export class SignerController {
  constructor(
    private readonly signerService: SignerService,
  ) {}

  private getWalletIdFromRequest(
    req: AuthenticatedRequest,
  ): number {
    const parsedWalletId = Number(req.user?.walletId);
    if (
      !Number.isInteger(parsedWalletId) ||
      parsedWalletId < 1
    ) {
      throw new ForbiddenException(
        'JWT walletId claim must be a positive integer',
      );
    }

    return parsedWalletId;
  }

  @Get('health')
  @Public()
  health() {
    return {
      status: 'ok',
      service: 'signer-service',
    };
  }

  @Get('me')
  getMe(@Req() req: AuthenticatedRequest) {
    return req.user;
  }

  @Get('address')
  @ApiOperation({ summary: 'Get signer wallet address' })
  @ApiResponse({ status: 200, type: AddressResponse })
  async getAddress(
    @Req() req: AuthenticatedRequest,
  ): Promise<AddressResponse> {
    return this.signerService.getAddress(
      this.getWalletIdFromRequest(req),
    );
  }

  @Get('available-networks')
  @ApiOperation({
    summary: 'Get configured available networks',
  })
  @ApiResponse({
    status: 200,
    type: AvailableNetworksResponse,
  })
  getAvailableNetworks(): AvailableNetworksResponse {
    return {
      networks: this.signerService.getAvailableNetworks(),
    };
  }

  @Post('sign-message')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign a message' })
  @ApiResponse({ status: 200, type: SignMessageResponse })
  async signMessage(
    @Body() dto: SignMessageDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<SignMessageResponse> {
    const resolvedWalletId =
      this.getWalletIdFromRequest(req);
    const signer = await this.signerService.getAddress(
      resolvedWalletId,
    );
    const message = dto.rawMessage
      ? ethers.getBytes(dto.rawMessage)
      : dto.message!;
    const signature = await this.signerService.signMessage(
      message,
      resolvedWalletId,
    );
    return { signature, ...signer };
  }

  @Post('send-transaction')
  @ApiOperation({ summary: 'Send a transaction' })
  @ApiResponse({
    status: 201,
    type: SendTransactionResult,
  })
  async sendTransaction(
    @Body() dto: SendTransactionDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<SendTransactionResponse> {
    const walletId = this.getWalletIdFromRequest(req);
    const result = await this.signerService.sendTransaction(
      dto.chainId,
      dto.to,
      dto.value,
      dto.data,
      walletId,
      dto.feeBumpPercent,
    );
    return result;
  }

  @Get('transaction/:hash')
  @ApiOperation({ summary: 'Get transaction details' })
  @ApiResponse({ status: 200, type: TransactionResponse })
  @ApiResponse({
    status: 404,
    description: 'Transaction not found',
  })
  async getTransaction(
    @Param('hash') hash: string,
    @Query('chainId', ParseIntPipe) chainId: number,
  ): Promise<TransactionResponse> {
    const tx = await this.signerService.getTransaction(
      chainId,
      hash,
    );
    if (!tx)
      throw new NotFoundException('Transaction not found');
    return tx;
  }

  @Get('nonce')
  @ApiOperation({
    summary: 'Get current nonce of the signer wallet',
  })
  @ApiResponse({ status: 200, type: NonceResponse })
  async getNonce(
    @Query('chainId', ParseIntPipe) chainId: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<NonceResponse> {
    const nonce = await this.signerService.getNonce(
      chainId,
      this.getWalletIdFromRequest(req),
    );
    return { nonce };
  }
}
