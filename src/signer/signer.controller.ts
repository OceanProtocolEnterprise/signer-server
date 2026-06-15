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
import {
  AddressResponse,
  SignMessageResponse,
  SendTransactionResponse,
  TransactionResponse,
  NonceResponse,
} from './interfaces/signer-responses.interface';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('signer')
@Controller()
@UseGuards(AuthentikGuard)
@ApiBearerAuth()
export class SignerController {
  constructor(private readonly signerService: SignerService) {}

  private parseOptionalWalletId(walletId?: string | number): number | undefined {
    if (walletId === undefined || walletId === null || walletId === '') {
      return undefined;
    }

    const parsedWalletId = Number(walletId);
    if (!Number.isInteger(parsedWalletId) || parsedWalletId < 1) {
      throw new BadRequestException('walletId must be a positive integer');
    }

    return parsedWalletId;
  }

  private getRequestWalletId(req: any): number | undefined {
    return this.parseOptionalWalletId(req.user?.orgWalletId);
  }

  private resolveWalletId(
    req: any,
    walletId?: string | number,
  ): number | undefined {
    return this.parseOptionalWalletId(walletId) ?? this.getRequestWalletId(req);
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
  getMe(@Req() req: any) {
    return req.user;
  }

  @Get('address')
  @ApiOperation({ summary: 'Get signer wallet address' })
  @ApiResponse({ status: 200, type: AddressResponse })
  async getAddress(
    @Req() req: any,
    @Query('walletId') walletId?: string,
  ): Promise<AddressResponse> {
    return this.signerService.getAddress(this.resolveWalletId(req, walletId));
  }

  @Post('sign-message')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign a message' })
  async signMessage(
    @Req() req: any,
    @Body() dto: SignMessageDto,
  ): Promise<SignMessageResponse> {
    const walletId = this.resolveWalletId(req, dto.walletId);
    const signer = await this.signerService.getAddress(walletId);
    const signature = await this.signerService.signMessage(
      dto.message,
      walletId,
    );
    return { signature, ...signer };
  }

  @Post('send-transaction')
  @ApiOperation({ summary: 'Send a transaction' })
  async sendTransaction(
    @Req() req: any,
    @Body() dto: SendTransactionDto,
  ): Promise<SendTransactionResponse> {
    const walletId = this.resolveWalletId(req, dto.walletId);
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
    const tx = await this.signerService.getTransaction(chainId, hash);
    if (!tx) throw new NotFoundException('Transaction not found');
    return tx;
  }

  @Get('nonce')
  @ApiOperation({ summary: 'Get current nonce of the signer wallet' })
  async getNonce(
    @Req() req: any,
    @Query('chainId', ParseIntPipe) chainId: number,
    @Query('walletId') walletId?: string,
  ): Promise<NonceResponse> {
    const nonce = await this.signerService.getNonce(
      chainId,
      this.resolveWalletId(req, walletId),
    );
    return { nonce };
  }
}
