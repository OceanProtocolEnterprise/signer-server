import { Controller, Get, Post, Body, Param, UseGuards, HttpCode, HttpStatus, NotFoundException } from '@nestjs/common';
import { Req } from '@nestjs/common';
import { SignerService } from './signer.service';
import { SignMessageDto } from './dto/sign-message.dto';
import { SendTransactionDto } from './dto/send-transaction.dto';
import { AuthentikGuard } from '../common/guards/authentik.guard';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
  @ApiResponse({ status: 200, type: Object })
  getAddress(): AddressResponse {
    return { address: this.signerService.getAddress() };
  }

  @Post('sign-message')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign a message' })
  async signMessage(@Body() dto: SignMessageDto): Promise<SignMessageResponse> {
    const signature = await this.signerService.signMessage(dto.message);
    return { signature, address: this.signerService.getAddress() };
  }

  @Post('send-transaction')
  @ApiOperation({ summary: 'Send a transaction' })
  async sendTransaction(@Body() dto: SendTransactionDto): Promise<SendTransactionResponse> {
    const result = await this.signerService.sendTransaction(dto.to, dto.value, dto.data);
    return result;
  }

  @Get('transaction/:hash')
  @ApiOperation({ summary: 'Get transaction details' })
  async getTransaction(@Param('hash') hash: string): Promise<TransactionResponse> {
    const tx = await this.signerService.getTransaction(hash);
    if (!tx) throw new NotFoundException('Transaction not found');
    return tx;
  }

  @Get('nonce')
  @ApiOperation({ summary: 'Get current nonce of the signer wallet' })
  async getNonce(): Promise<NonceResponse> {
    const nonce = await this.signerService.getNonce();
    return { nonce };
  }
}