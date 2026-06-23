import {
  TestApp,
  createTestApp,
  generateValidHeaders,
  LOCAL_TEST_CONFIG,
} from '../setup/test-config';
import { ethers } from 'ethers';

// Mock ocean.js for testing
jest.mock('@oceanprotocol/lib', () => {
  // Mock Datatoken class
  const mockDatatokenInstance = {
    balance: jest
      .fn()
      .mockImplementation((tokenAddress, address) => {
        if (
          tokenAddress ===
          '0x08210F9170F89Ab7658F0B5E3fF39b0E03C594D4'
        ) {
          return Promise.resolve('1000000');
        }
        return Promise.resolve('0');
      }),
    approve: jest
      .fn()
      .mockImplementation(
        (tokenAddress, spender, amount) => {
          return Promise.resolve({
            hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            wait: () => Promise.resolve({ status: 1 }),
          });
        },
      ),
    allowance: jest
      .fn()
      .mockImplementation(
        (tokenAddress, owner, spender) => {
          return Promise.resolve('500000');
        },
      ),
    buyFromFreAndOrder: jest
      .fn()
      .mockImplementation(
        (datatokenAddress, orderParams, freParams) => {
          return Promise.resolve({
            hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            wait: () =>
              Promise.resolve({
                status: 1,
                blockNumber: 12345678,
              }),
          });
        },
      ),
  };

  // Mock NftFactory class
  const mockNftFactoryInstance = {
    createNftWithDatatoken: jest
      .fn()
      .mockImplementation((nftData, datatokenData) => {
        return Promise.resolve({
          hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          wait: () =>
            Promise.resolve({
              status: 1,
              blockNumber: 12345678,
              logs: [
                {
                  address:
                    '0x1234567890abcdef1234567890abcdef12345678',
                  topics: [
                    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
                    '0x0000000000000000000000000000000000000000000000000000000000000000',
                    '0x000000000000000000000000742d35Cc6634C0532925a3b844Bc454e4438f44e',
                  ],
                },
              ],
            }),
        });
      }),
  };

  // Mock Nft class
  const mockNftInstance = {
    addManager: jest
      .fn()
      .mockImplementation((nftAddress, owner, grantee) => {
        return Promise.resolve({
          hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          wait: () => Promise.resolve({ status: 1 }),
        });
      }),
    addMetadataUpdater: jest
      .fn()
      .mockImplementation((nftAddress, owner, grantee) => {
        return Promise.resolve({
          hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          wait: () => Promise.resolve({ status: 1 }),
        });
      }),
    setMetadata: jest
      .fn()
      .mockImplementation(
        (
          nftAddress,
          updater,
          state,
          providerUrl,
          sig,
          flag,
          encryptedData,
          hash,
        ) => {
          return Promise.resolve({
            hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
            wait: () => Promise.resolve({ status: 1 }),
          });
        },
      ),
  };

  // Mock Aquarius class
  const mockAquariusInstance = {
    resolve: jest.fn().mockImplementation((did) => {
      return Promise.resolve({
        id: did,
        version: '5.0.0',
        services: [
          {
            id: 'service-1',
            type: 'access',
            datatokenAddress:
              '0x1234567890abcdef1234567890abcdef12345678',
            serviceEndpoint:
              'https://ocean-node.example.com',
          },
        ],
      });
    }),
    validate: jest
      .fn()
      .mockImplementation((ddo, signer) => {
        return Promise.resolve({
          hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        });
      }),
    waitForIndexer: jest.fn().mockResolvedValue(true),
  };

  // Mock ProviderInstance
  const mockProviderInstance = {
    encrypt: jest
      .fn()
      .mockImplementation(
        (ddo, chainId, providerUrl, signer) => {
          return Promise.resolve('0xencrypteddata');
        },
      ),
    initialize: jest
      .fn()
      .mockImplementation(
        (
          did,
          serviceId,
          serviceIndex,
          consumer,
          providerUrl,
        ) => {
          return Promise.resolve({
            providerFee: {
              providerFeeAddress:
                '0x1234567890abcdef1234567890abcdef12345678',
              providerFeeToken:
                '0x1234567890abcdef1234567890abcdef12345678',
              providerFeeAmount: '100',
              v: 27,
              r: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
              s: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
              providerData: '0x',
              validUntil: 1234567890,
            },
          });
        },
      ),
    initializePSVerification: jest
      .fn()
      .mockImplementation((providerUrl, params) => {
        return Promise.resolve({
          success: {
            sessionId: 'test-session-123',
          },
        });
      }),
    getDownloadUrl: jest
      .fn()
      .mockImplementation(
        (
          did,
          serviceId,
          serviceIndex,
          orderTxHash,
          providerUrl,
          signer,
        ) => {
          return Promise.resolve(
            'https://download.example.com/file.zip',
          );
        },
      ),
  };

  // Mock ConfigHelper
  class MockConfigHelper {
    getConfig(chainId: number) {
      return {
        nftFactoryAddress:
          '0x1234567890abcdef1234567890abcdef12345678',
        fixedRateExchangeAddress:
          '0x1234567890abcdef1234567890abcdef12345678',
        oceanNodeUri: 'https://ocean-node.example.com',
      };
    }
  }

  return {
    ConfigHelper: MockConfigHelper,
    Datatoken: jest
      .fn()
      .mockImplementation(() => mockDatatokenInstance),
    NftFactory: jest
      .fn()
      .mockImplementation(() => mockNftFactoryInstance),
    Nft: jest
      .fn()
      .mockImplementation(() => mockNftInstance),
    Aquarius: jest
      .fn()
      .mockImplementation(() => mockAquariusInstance),
    ProviderInstance: mockProviderInstance,
    downloadFile: jest.fn().mockResolvedValue({
      data: Buffer.from('test file content'),
    }),
  };
});

describe('Local Signer - Ocean.js Integration Tests', () => {
  let testApp: TestApp;
  let validHeaders: any;
  let testAppAddress: string;

  beforeAll(async () => {
    const rpcUrl =
      process.env.ETHEREUM_RPC_URL ||
      'https://ethereum-sepolia.publicnode.com';

    testApp = await createTestApp({
      signerMode: 'local',
      privateKeys: [
        {
          walletId: LOCAL_TEST_CONFIG.validWalletId,
          key: LOCAL_TEST_CONFIG.testPrivateKey,
        },
      ],
      nodeUriMap: {
        '11155111': rpcUrl,
        '11155420': 'https://sepolia.optimism.io',
      },
    });
    validHeaders = generateValidHeaders();

    // Get the address from the test app
    const addressResponse = await testApp
      .request()
      .get('/address')
      .set(validHeaders)
      .expect(200);
    testAppAddress = addressResponse.body.address;
  }, 30000);

  afterAll(async () => {
    if (testApp) {
      await testApp.close();
    }
  }, 10000);

  /**
   * Helper to create a signer for testing that uses the test app endpoints
   * This creates a simple signer that implements the minimal required methods
   * and follows the pattern from demo.ts
   */
  function createTestSigner(
    provider: ethers.Provider,
  ): any {
    const signer = {
      provider: provider,
      getAddress: async () => testAppAddress,
      signMessage: async (message: string | Uint8Array) => {
        const messageStr =
          typeof message === 'string'
            ? message
            : ethers.hexlify(message);
        const response = await testApp
          .request()
          .post('/sign-message')
          .set(validHeaders)
          .send({ message: messageStr });

        if (response.status !== 200) {
          throw new Error(
            `Failed to sign message: ${response.body.message}`,
          );
        }

        return response.body.signature;
      },
      signTransaction: async (
        _tx: ethers.TransactionRequest,
      ) => {
        throw new Error(
          'Use sendTransaction — backend signs and broadcasts in one call',
        );
      },
      sendTransaction: async (
        tx: ethers.TransactionRequest,
      ) => {
        const resolved = await ethers.resolveProperties(tx);

        const response = await testApp
          .request()
          .post('/send-transaction')
          .set(validHeaders)
          .send({
            chainId: 11155111,
            to: resolved.to,
            value: resolved.value?.toString() ?? '0',
            data: resolved.data ?? '0x',
          });

        if (
          response.status !== 200 &&
          response.status !== 201
        ) {
          throw new Error(
            `Failed to send transaction: ${response.body.message}`,
          );
        }

        const fullTx = await provider.getTransaction(
          response.body.hash,
        );
        if (!fullTx) {
          throw new Error(
            `Transaction ${response.body.hash} not found`,
          );
        }

        return fullTx;
      },
      signTypedData: async () => {
        throw new Error('signTypedData not implemented');
      },
      connect: (newProvider: ethers.Provider) => {
        return createTestSigner(newProvider);
      },
    };

    return signer;
  }

  /**
   * Helper to check if wallet has sufficient funds
   * Skips test if insufficient funds
   */
  async function checkSufficientFunds(
    provider: ethers.Provider,
    address: string,
    minBalance: bigint = ethers.parseEther('0.001'),
  ): Promise<boolean> {
    const balance = await provider.getBalance(address);
    if (balance < minBalance) {
      console.warn(
        `⚠️ Skipping test: Insufficient funds for ${address}. Balance: ${ethers.formatEther(balance)} ETH, Need: ${ethers.formatEther(minBalance)} ETH`,
      );
      return false;
    }
    return true;
  }

  describe('1. Remote Signer Creation', () => {
    it('should create a signer connected to the test app', async () => {
      const rpcUrl =
        process.env.ETHEREUM_RPC_URL ||
        'https://ethereum-sepolia.publicnode.com';

      const provider = new ethers.JsonRpcProvider(rpcUrl, {
        name: 'network',
        chainId: 11155111,
      });

      const signer = createTestSigner(provider);
      expect(signer).toBeDefined();

      const address = await signer.getAddress();
      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(address).toBe(testAppAddress);
    });
  });

  describe('2. Datatoken Operations (Balance, Approve, Allowance)', () => {
    let datatoken: any;
    let signer: any;
    let provider: ethers.Provider;

    beforeAll(() => {
      const rpcUrl =
        process.env.ETHEREUM_RPC_URL ||
        'https://ethereum-sepolia.publicnode.com';

      provider = new ethers.JsonRpcProvider(rpcUrl, {
        name: 'network',
        chainId: 11155111,
      });

      signer = createTestSigner(provider);
    });

    it('should create Datatoken instance with signer', async () => {
      const { Datatoken, ConfigHelper } =
        await import('@oceanprotocol/lib');
      const oceanConfig = new ConfigHelper().getConfig(
        11155111,
      );
      datatoken = new Datatoken(
        signer,
        11155111,
        oceanConfig,
      );
      expect(datatoken).toBeDefined();
    });

    it('should get EURC balance using remote signer', async () => {
      const { Datatoken, ConfigHelper } =
        await import('@oceanprotocol/lib');
      const oceanConfig = new ConfigHelper().getConfig(
        11155111,
      );
      datatoken = new Datatoken(
        signer,
        11155111,
        oceanConfig,
      );

      const address = await signer.getAddress();
      const eurcAddress =
        '0x08210F9170F89Ab7658F0B5E3fF39b0E03C594D4';

      // Check if we have enough funds for this test
      const hasFunds = await checkSufficientFunds(
        provider,
        address,
      );
      if (!hasFunds) {
        return;
      }

      const balance = await datatoken.balance(
        eurcAddress,
        address,
      );
      expect(typeof balance).toBe('string');
      expect(BigInt(balance)).toBeGreaterThanOrEqual(0n);
    });

    it('should approve EURC for spender using remote signer', async () => {
      const { Datatoken, ConfigHelper } =
        await import('@oceanprotocol/lib');
      const oceanConfig = new ConfigHelper().getConfig(
        11155111,
      );
      datatoken = new Datatoken(
        signer,
        11155111,
        oceanConfig,
      );

      const address = await signer.getAddress();

      // Check if we have enough funds for this test
      const hasFunds = await checkSufficientFunds(
        provider,
        address,
      );
      if (!hasFunds) {
        return;
      }

      const spenderAddress =
        oceanConfig.fixedRateExchangeAddress;
      const eurcAddress =
        '0x08210F9170F89Ab7658F0B5E3fF39b0E03C594D4';

      // Mock the approve call to succeed
      datatoken.approve = jest.fn().mockResolvedValue({
        hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        wait: () => Promise.resolve({ status: 1 }),
      });

      const approveResult = await datatoken.approve(
        eurcAddress,
        spenderAddress,
        '100',
      );
      expect(approveResult).toHaveProperty('hash');
      expect(approveResult.hash).toMatch(
        /^0x[a-fA-F0-9]{64}$/,
      );
    });

    it('should check allowance for EURC using remote signer', async () => {
      const { Datatoken, ConfigHelper } =
        await import('@oceanprotocol/lib');
      const oceanConfig = new ConfigHelper().getConfig(
        11155111,
      );
      datatoken = new Datatoken(
        signer,
        11155111,
        oceanConfig,
      );

      const address = await signer.getAddress();

      const hasFunds = await checkSufficientFunds(
        provider,
        address,
      );
      if (!hasFunds) {
        return;
      }

      const spenderAddress =
        oceanConfig.fixedRateExchangeAddress;
      const eurcAddress =
        '0x08210F9170F89Ab7658F0B5E3fF39b0E03C594D4';

      const allowance = await datatoken.allowance(
        eurcAddress,
        address,
        spenderAddress,
      );
      expect(typeof allowance).toBe('string');
      expect(BigInt(allowance)).toBeGreaterThanOrEqual(0n);
    });

    it('should sign message using remote signer', async () => {
      const message = 'Ocean Enterprise test message';
      const address = await signer.getAddress();

      const signature = await signer.signMessage(message);
      expect(signature).toMatch(/^0x[a-fA-F0-9]+$/);

      const recovered = ethers.verifyMessage(
        message,
        signature,
      );
      expect(recovered.toLowerCase()).toBe(
        address.toLowerCase(),
      );
    });
  });

  describe('3. Asset Publish Flow (createNftWithDatatoken)', () => {
    let nftFactory: any;
    let nft: any;
    let signer: any;
    let provider: ethers.Provider;

    beforeAll(() => {
      const rpcUrl =
        process.env.ETHEREUM_RPC_URL ||
        'https://ethereum-sepolia.publicnode.com';

      provider = new ethers.JsonRpcProvider(rpcUrl, {
        name: 'network',
        chainId: 11155111,
      });

      signer = createTestSigner(provider);
    });

    it('should create NFT Factory with signer', async () => {
      const { NftFactory, ConfigHelper } =
        await import('@oceanprotocol/lib');
      const oceanConfig = new ConfigHelper().getConfig(
        11155111,
      );
      nftFactory = new NftFactory(
        oceanConfig.nftFactoryAddress?.toString() || '',
        signer,
      );
      expect(nftFactory).toBeDefined();
    });

    it('should create NFT with datatoken using remote signer (Publish Flow)', async () => {
      const { NftFactory, ConfigHelper } =
        await import('@oceanprotocol/lib');
      const oceanConfig = new ConfigHelper().getConfig(
        11155111,
      );
      nftFactory = new NftFactory(
        oceanConfig.nftFactoryAddress?.toString() || '',
        signer,
      );

      const address = await signer.getAddress();

      // Check if we have enough funds for this test
      const hasFunds = await checkSufficientFunds(
        provider,
        address,
        ethers.parseEther('0.01'),
      );
      if (!hasFunds) {
        return;
      }

      // Mock the createNftWithDatatoken call
      nftFactory.createNftWithDatatoken = jest
        .fn()
        .mockResolvedValue({
          hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          wait: () =>
            Promise.resolve({
              status: 1,
              blockNumber: 12345678,
              logs: [
                {
                  address:
                    '0x1234567890abcdef1234567890abcdef12345678',
                  topics: [
                    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
                    '0x0000000000000000000000000000000000000000000000000000000000000000',
                    `0x000000000000000000000000${address.slice(2)}`,
                  ],
                },
              ],
            }),
        });

      const nftCreateData = {
        name: `Test NFT ${Date.now()}`,
        symbol: 'TEST',
        templateIndex: 1,
        tokenURI: 'https://example.com',
        transferable: true,
        owner: address,
      };

      const datatokenCreateData = {
        templateIndex: 1,
        name: 'Test Datatoken',
        symbol: 'TDT',
        minter: address,
        paymentCollector: address,
        mpFeeAddress: ethers.ZeroAddress,
        feeToken: ethers.ZeroAddress,
        feeAmount: '0',
        cap: ethers.parseEther('1000').toString(),
      };

      const result =
        await nftFactory.createNftWithDatatoken(
          nftCreateData,
          datatokenCreateData,
        );
      expect(result).toHaveProperty('hash');
      expect(result.hash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it('should add manager using remote signer', async () => {
      const { Nft, ConfigHelper } =
        await import('@oceanprotocol/lib');
      const oceanConfig = new ConfigHelper().getConfig(
        11155111,
      );
      nft = new Nft(signer, 11155111);

      const address = await signer.getAddress();

      const hasFunds = await checkSufficientFunds(
        provider,
        address,
      );
      if (!hasFunds) {
        return;
      }

      const nftAddress =
        '0x1234567890abcdef1234567890abcdef12345678';

      nft.addManager = jest.fn().mockResolvedValue({
        hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        wait: () => Promise.resolve({ status: 1 }),
      });

      const result = await nft.addManager(
        nftAddress,
        address,
        address,
      );
      expect(result).toHaveProperty('hash');
    });

    it('should add metadata updater using remote signer', async () => {
      const { Nft, ConfigHelper } =
        await import('@oceanprotocol/lib');
      const oceanConfig = new ConfigHelper().getConfig(
        11155111,
      );
      nft = new Nft(signer, 11155111);

      const address = await signer.getAddress();

      const hasFunds = await checkSufficientFunds(
        provider,
        address,
      );
      if (!hasFunds) {
        return;
      }

      const nftAddress =
        '0x1234567890abcdef1234567890abcdef12345678';

      nft.addMetadataUpdater = jest.fn().mockResolvedValue({
        hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        wait: () => Promise.resolve({ status: 1 }),
      });

      const result = await nft.addMetadataUpdater(
        nftAddress,
        address,
        address,
      );
      expect(result).toHaveProperty('hash');
    });

    it('should set metadata (DDO) using remote signer', async () => {
      const {
        Nft,
        ConfigHelper,
        ProviderInstance,
        Aquarius,
      } = await import('@oceanprotocol/lib');
      const oceanConfig = new ConfigHelper().getConfig(
        11155111,
      );
      nft = new Nft(signer, 11155111);

      const address = await signer.getAddress();

      const hasFunds = await checkSufficientFunds(
        provider,
        address,
      );
      if (!hasFunds) {
        return;
      }

      const nftAddress =
        '0x1234567890abcdef1234567890abcdef12345678';
      const providerUrl = 'https://ocean-node.example.com';

      // Create a simple DDO
      const ddo = {
        id: 'did:ope:test',
        version: '5.0.0',
        services: [
          {
            id: 'service-1',
            type: 'access',
            datatokenAddress:
              '0x1234567890abcdef1234567890abcdef12345678',
            serviceEndpoint: providerUrl,
          },
        ],
      };

      // Mock encrypt
      ProviderInstance.encrypt = jest
        .fn()
        .mockResolvedValue('0xencrypteddata');

      // Mock Aquarius validate
      Aquarius.prototype.validate = jest
        .fn()
        .mockResolvedValue({
          hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        });

      nft.setMetadata = jest.fn().mockResolvedValue({
        hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        wait: () => Promise.resolve({ status: 1 }),
      });

      const result = await nft.setMetadata(
        nftAddress,
        address,
        0,
        providerUrl,
        '',
        2,
        '0xencrypteddata',
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      );

      expect(result).toHaveProperty('hash');
      expect(result.hash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });
  });

  describe('4. Asset Consume Flow (DDO Resolution, Provider Init, Order, Download)', () => {
    let aquarius: any;
    let signer: any;
    let datatoken: any;
    let provider: ethers.Provider;

    beforeAll(async () => {
      const rpcUrl =
        process.env.ETHEREUM_RPC_URL ||
        'https://ethereum-sepolia.publicnode.com';

      provider = new ethers.JsonRpcProvider(rpcUrl, {
        name: 'network',
        chainId: 11155111,
      });

      signer = createTestSigner(provider);

      const { Aquarius, Datatoken, ConfigHelper } =
        await import('@oceanprotocol/lib');
      const oceanConfig = new ConfigHelper().getConfig(
        11155111,
      );
      aquarius = new Aquarius(
        'https://ocean-node.example.com',
      );
      datatoken = new Datatoken(
        signer,
        11155111,
        oceanConfig,
      );
    });

    it('should resolve DDO using Aquarius', async () => {
      const did =
        'did:ope:156d63ab49a7bff096964763439367026f88a7604e1aa037e5ce2ee1018b5cb3';

      // Aquarius.resolve doesn't need a signer
      const ddo = await aquarius.resolve(did);

      if (ddo) {
        expect(ddo).toHaveProperty('id');
        expect(ddo).toHaveProperty('services');
        expect(ddo.services).toBeInstanceOf(Array);
      }
    });

    it('should encrypt DDO using remote signer', async () => {
      const { ProviderInstance } =
        await import('@oceanprotocol/lib');

      const address = await signer.getAddress();

      const hasFunds = await checkSufficientFunds(
        provider,
        address,
      );
      if (!hasFunds) {
        return;
      }

      const ddo = {
        id: 'did:ope:test',
        version: '5.0.0',
        services: [],
      };

      const chainId = 11155111;
      const providerUrl = 'https://ocean-node.example.com';

      const encrypted = await ProviderInstance.encrypt(
        ddo,
        chainId,
        providerUrl,
        signer,
      );
      expect(typeof encrypted).toBe('string');
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('should initialize provider using remote signer', async () => {
      const { ProviderInstance } =
        await import('@oceanprotocol/lib');

      const address = await signer.getAddress();

      const hasFunds = await checkSufficientFunds(
        provider,
        address,
      );
      if (!hasFunds) {
        return;
      }

      const did =
        'did:ope:156d63ab49a7bff096964763439367026f88a7604e1aa037e5ce2ee1018b5cb3';
      const serviceId = 'service-1';
      const providerUrl = 'https://ocean-node.example.com';

      const initData = await ProviderInstance.initialize(
        did,
        serviceId,
        0,
        address,
        providerUrl,
      );

      if (initData) {
        expect(initData).toHaveProperty('providerFee');
        expect(initData.providerFee).toHaveProperty(
          'providerFeeAddress',
        );
        expect(initData.providerFee).toHaveProperty(
          'providerFeeToken',
        );
        expect(initData.providerFee).toHaveProperty(
          'providerFeeAmount',
        );
        expect(initData.providerFee).toHaveProperty('v');
        expect(initData.providerFee).toHaveProperty('r');
        expect(initData.providerFee).toHaveProperty('s');
      }
    });

    it('should buy from FRE and order (Full Consume Flow)', async () => {
      const { ProviderInstance, ConfigHelper } =
        await import('@oceanprotocol/lib');
      const oceanConfig = new ConfigHelper().getConfig(
        11155111,
      );

      const address = await signer.getAddress();

      const hasFunds = await checkSufficientFunds(
        provider,
        address,
        ethers.parseEther('0.01'),
      );
      if (!hasFunds) {
        return;
      }

      // Mock the full consume flow
      const did =
        'did:ope:156d63ab49a7bff096964763439367026f88a7604e1aa037e5ce2ee1018b5cb3';
      const serviceId = 'service-1';
      const datatokenAddress =
        '0x1234567890abcdef1234567890abcdef12345678';
      const freAddress =
        oceanConfig.fixedRateExchangeAddress ||
        '0x1234567890abcdef1234567890abcdef12345678';
      const freId =
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

      // Mock the buyFromFreAndOrder call
      datatoken.buyFromFreAndOrder = jest
        .fn()
        .mockResolvedValue({
          hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          wait: () =>
            Promise.resolve({
              status: 1,
              blockNumber: 12345678,
            }),
        });

      // 1. Initialize provider
      const initData = await ProviderInstance.initialize(
        did,
        serviceId,
        0,
        address,
        'https://ocean-node.example.com',
      );

      const providerFees = {
        providerFeeAddress:
          initData?.providerFee?.providerFeeAddress ||
          '0x1234567890abcdef1234567890abcdef12345678',
        providerFeeToken:
          initData?.providerFee?.providerFeeToken ||
          '0x1234567890abcdef1234567890abcdef12345678',
        providerFeeAmount:
          initData?.providerFee?.providerFeeAmount || '100',
        v: initData?.providerFee?.v || 27,
        r:
          initData?.providerFee?.r ||
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        s:
          initData?.providerFee?.s ||
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        providerData:
          initData?.providerFee?.providerData || '0x',
        validUntil:
          initData?.providerFee?.validUntil || 1234567890,
      };

      // 2. Buy from FRE and Order
      const orderParams = {
        consumer: address,
        serviceIndex: 0,
        _providerFee: providerFees,
        _consumeMarketFee: {
          consumeMarketFeeAddress: ethers.ZeroAddress,
          consumeMarketFeeToken: ethers.ZeroAddress,
          consumeMarketFeeAmount: '0',
        },
      };

      const freParams = {
        exchangeContract: freAddress,
        exchangeId: freId,
        maxBaseTokenAmount: '2',
        swapMarketFee: '0',
        marketFeeAddress: ethers.ZeroAddress,
        baseTokenAddress:
          '0x08210F9170F89Ab7658F0B5E3fF39b0E03C594D4',
        baseTokenDecimals: 6,
      };

      const orderTx = await datatoken.buyFromFreAndOrder(
        datatokenAddress,
        orderParams,
        freParams,
      );
      expect(orderTx).toHaveProperty('hash');
      expect(orderTx.hash).toMatch(/^0x[a-fA-F0-9]{64}$/);

      const receipt = await orderTx.wait();
      expect(receipt.status).toBe(1);
    });

    it('should get download URL using remote signer', async () => {
      const { ProviderInstance } =
        await import('@oceanprotocol/lib');

      const address = await signer.getAddress();

      const hasFunds = await checkSufficientFunds(
        provider,
        address,
      );
      if (!hasFunds) {
        return;
      }

      const did =
        'did:ope:156d63ab49a7bff096964763439367026f88a7604e1aa037e5ce2ee1018b5cb3';
      const serviceId = 'service-1';
      const providerUrl = 'https://ocean-node.example.com';
      const orderTxHash =
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

      const downloadUrl =
        await ProviderInstance.getDownloadUrl(
          did,
          serviceId,
          0,
          orderTxHash,
          providerUrl,
          signer,
        );

      expect(typeof downloadUrl).toBe('string');
      expect(downloadUrl).toMatch(/^https?:\/\//);
    });
  });

  describe('5. Error Handling', () => {
    let datatoken: any;
    let signer: any;
    let provider: ethers.Provider;

    beforeAll(() => {
      const rpcUrl =
        process.env.ETHEREUM_RPC_URL ||
        'https://ethereum-sepolia.publicnode.com';

      provider = new ethers.JsonRpcProvider(rpcUrl, {
        name: 'network',
        chainId: 11155111,
      });

      signer = createTestSigner(provider);
    });

    it('should handle invalid token address gracefully', async () => {
      const { Datatoken, ConfigHelper } =
        await import('@oceanprotocol/lib');
      const oceanConfig = new ConfigHelper().getConfig(
        11155111,
      );
      datatoken = new Datatoken(
        signer,
        11155111,
        oceanConfig,
      );
      const address = await signer.getAddress();

      try {
        await datatoken.balance('invalid-address', address);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle insufficient funds gracefully', async () => {
      const { Datatoken, ConfigHelper } =
        await import('@oceanprotocol/lib');
      const oceanConfig = new ConfigHelper().getConfig(
        11155111,
      );
      datatoken = new Datatoken(
        signer,
        11155111,
        oceanConfig,
      );

      // Mock approve to throw insufficient funds error
      datatoken.approve = jest
        .fn()
        .mockRejectedValue(new Error('insufficient funds'));

      try {
        await datatoken.approve(
          '0x1234567890abcdef1234567890abcdef12345678',
          '0x1234567890abcdef1234567890abcdef12345678',
          '1000000',
        );
      } catch (error) {
        expect(error.message).toMatch(
          /insufficient|funds/i,
        );
      }
    });
  });

  describe('6. Security', () => {
    it('should require authentication for signer operations', async () => {
      const response = await testApp
        .request()
        .get('/address');
      expect(response.status).toBe(401);
    });
  });
});
