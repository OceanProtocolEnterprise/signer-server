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
  BadRequestException,
  Logger,
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
import { Request } from 'express';
import {
  AddressResponse,
  SignMessageResponse,
  SendTransactionResponse,
  TransactionResponse,
  NonceResponse,
} from './interfaces/signer-responses.interface';
import { Public } from '../common/decorators/public.decorator';

type AuthenticatedRequest = Request & {
  user?: unknown;
};

@ApiTags('signer')
@Controller()
@UseGuards(AuthentikGuard)
@ApiBearerAuth()
export class SignerController {
  private readonly logger = new Logger(SignerController.name);

  constructor(
    private readonly signerService: SignerService,
  ) {}

  private parseOptionalWalletId(
    walletId?: string | number,
  ): number | undefined {
    if (
      walletId === undefined ||
      walletId === null ||
      walletId === ''
    ) {
      return undefined;
    }

    const parsedWalletId = Number(walletId);
    if (
      !Number.isInteger(parsedWalletId) ||
      parsedWalletId < 1
    ) {
      throw new BadRequestException(
        'walletId must be a positive integer',
      );
    }

    return parsedWalletId;
  }

  private resolveWalletId(
    ...walletIds: Array<string | number | undefined>
  ): number | undefined {
    for (const walletId of walletIds) {
      const parsedWalletId =
        this.parseOptionalWalletId(walletId);
      if (parsedWalletId !== undefined) {
        return parsedWalletId;
      }
    }

    return undefined;
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
    @Query('walletId') walletId?: string,
  ): Promise<AddressResponse> {
    return this.signerService.getAddress(
      this.resolveWalletId(walletId),
    );
  }

  @Post('sign-message')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign a message' })
  async signMessage(
    @Body() dto: SignMessageDto,
  ): Promise<SignMessageResponse> {
    this.logger.log(
      `SIGN MESSAGE dto: ${JSON.stringify(dto)}`,
    );
    const resolvedWalletId = this.resolveWalletId(
      dto.walletId,
    );
    this.logger.log(
      `SIGN MESSAGE resolvedWalletId: ${resolvedWalletId}`,
    );
    const signer = await this.signerService.getAddress(
      resolvedWalletId,
    );
    this.logger.log(
      `SIGN MESSAGE signer: ${JSON.stringify(signer)}`,
    );
    const signature = await this.signerService.signMessage(
      dto.message,
      resolvedWalletId,
    );
    this.logger.log(
      `SIGN MESSAGE signature: ${signature}`,
    );
    return { signature, ...signer };
  }

  @Post('send-transaction')
  @ApiOperation({ summary: 'Send a transaction' })
  async sendTransaction(
    @Body() dto: SendTransactionDto,
  ): Promise<SendTransactionResponse> {
    const walletId = this.resolveWalletId(dto.walletId);
    const result = await this.signerService.sendTransaction(
      dto.chainId,
      dto.to,
      dto.value,
      dto.data,
      walletId,
    );
    return result;
  }

  @Get('transaction/:hash')
  @ApiOperation({ summary: 'Get transaction details' })
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
  async getNonce(
    @Query('chainId', ParseIntPipe) chainId: number,
    @Query('walletId') walletId?: string,
  ): Promise<NonceResponse> {
    const nonce = await this.signerService.getNonce(
      chainId,
      this.resolveWalletId(walletId),
    );
    return { nonce };
  }
}
