/**
 * Unit tests for FileSystemStore (base classes)
 */

import { FileSystemStore, SingleFileStore, MultiFileStore } from '../FileSystemStore';
import { Vault, normalizePath } from 'obsidian';
import { DataPathManager } from '../DataPathManager';
import { StorageError } from '../../utils/errorUtils';

// Mock logger
jest.mock('../../utils/Logger', () => ({
	logger: {
		methodEntry: jest.fn(),
		methodExit: jest.fn(),
		debug: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
	},
}));

// Mock normalizePath
jest.mock('obsidian', () => ({
	normalizePath: jest.fn((path: string) => path.replace(/\\/g, '/')),
}));

// Mock safeJsonParse
jest.mock('../../utils/errorUtils', () => ({
	StorageError: class extends Error {
		constructor(message: string, public path: string) {
			super(message);
			this.name = 'StorageError';
		}
	},
	safeJsonParse: jest.fn((content: string, fallback: any) => {
		try {
			return JSON.parse(content);
		} catch {
			return fallback;
		}
	}),
}));

// Test data type
interface TestData {
	id: string;
	name: string;
	value: number;
}

// Concrete SingleFileStore implementation for testing
class TestSingleFileStore extends SingleFileStore<TestData> {
	validate(data: TestData): boolean {
		return (
			data &&
			typeof data === 'object' &&
			typeof data.id === 'string' &&
			typeof data.name === 'string' &&
			typeof data.value === 'number'
		);
	}

	getDefaultValue(): TestData {
		return { id: 'default', name: 'Default', value: 0 };
	}
}

// Concrete MultiFileStore implementation for testing
class TestMultiFileStore extends MultiFileStore<TestData[], TestData> {
	validate(data: TestData[]): boolean {
		return Array.isArray(data);
	}

	getDefaultValue(): TestData[] {
		return [];
	}

	async loadAllItems(): Promise<TestData[]> {
		const ids = await this.listItemIds();
		const items: TestData[] = [];
		for (const id of ids) {
			const item = await this.loadItem(id, this.getDefaultValue()[0]);
			if (item) {
				items.push(item);
			}
		}
		return items;
	}

	async load(): Promise<TestData[]> {
		return await this.loadAllItems();
	}

	async save(data: TestData[]): Promise<void> {
		if (!this.validate(data)) {
			throw new StorageError('Invalid data', this.dirPath);
		}
		await this.clear();
		for (const item of data) {
			await this.saveItem(item.id, item);
		}
	}
}

describe('FileSystemStore', () => {
	describe('SingleFileStore', () => {
		let store: TestSingleFileStore;
		let mockVault: jest.Mocked<Vault>;
		let mockPathManager: jest.Mocked<DataPathManager>;
		let mockAdapter: any;

		beforeEach(() => {
			jest.clearAllMocks();

			mockAdapter = {
				exists: jest.fn(),
				read: jest.fn(),
				write: jest.fn(),
				remove: jest.fn(),
			};

			mockVault = {
				adapter: mockAdapter,
			} as any;

			mockPathManager = {
				createBackup: jest.fn(),
			} as any;

			store = new TestSingleFileStore(mockVault, mockPathManager, 'test-data.json');
		});

		describe('constructor', () => {
			it('should create store with file path', () => {
				expect(store).toBeInstanceOf(TestSingleFileStore);
				expect(store).toBeInstanceOf(SingleFileStore);
				expect(store).toBeInstanceOf(FileSystemStore);
			});
		});

		describe('load', () => {
			it('should load data from file', async () => {
				const testData: TestData = { id: 'test', name: 'Test', value: 42 };
				mockAdapter.exists.mockResolvedValue(true);
				mockAdapter.read.mockResolvedValue(JSON.stringify(testData));

				const result = await store.load();

				expect(result).toEqual(testData);
				expect(mockAdapter.exists).toHaveBeenCalledWith('test-data.json');
				expect(mockAdapter.read).toHaveBeenCalledWith('test-data.json');
			});

			it('should return default value if file does not exist', async () => {
				mockAdapter.exists.mockResolvedValue(false);

				const result = await store.load();

				expect(result).toEqual({ id: 'default', name: 'Default', value: 0 });
				expect(mockAdapter.read).not.toHaveBeenCalled();
			});

			it('should return default value if validation fails', async () => {
				mockAdapter.exists.mockResolvedValue(true);
				mockAdapter.read.mockResolvedValue(JSON.stringify({ invalid: 'data' }));

				const result = await store.load();

				expect(result).toEqual({ id: 'default', name: 'Default', value: 0 });
			});

			it('should throw StorageError on read failure', async () => {
				mockAdapter.exists.mockResolvedValue(true);
				mockAdapter.read.mockRejectedValue(new Error('Read failed'));

				await expect(store.load()).rejects.toThrow(StorageError);
			});
		});

		describe('save', () => {
			it('should save data to file', async () => {
				const testData: TestData = { id: 'test', name: 'Test', value: 42 };
				mockAdapter.exists.mockResolvedValue(false);

				await store.save(testData);

				expect(mockAdapter.write).toHaveBeenCalledWith(
					'test-data.json',
					JSON.stringify(testData, null, 2)
				);
			});

			it('should create backup before saving if file exists', async () => {
				const testData: TestData = { id: 'test', name: 'Test', value: 42 };
				mockAdapter.exists.mockResolvedValue(true);

				await store.save(testData);

				expect(mockPathManager.createBackup).toHaveBeenCalledWith('test-data.json');
				expect(mockAdapter.write).toHaveBeenCalled();
			});

			it('should continue saving if backup fails', async () => {
				const testData: TestData = { id: 'test', name: 'Test', value: 42 };
				mockAdapter.exists.mockResolvedValue(true);
				mockPathManager.createBackup.mockRejectedValue(new Error('Backup failed'));

				await store.save(testData);

				expect(mockAdapter.write).toHaveBeenCalled();
			});

			it('should throw StorageError if validation fails', async () => {
				const invalidData = { invalid: 'data' } as any;

				await expect(store.save(invalidData)).rejects.toThrow(StorageError);
				expect(mockAdapter.write).not.toHaveBeenCalled();
			});

			it('should throw StorageError on write failure', async () => {
				const testData: TestData = { id: 'test', name: 'Test', value: 42 };
				mockAdapter.exists.mockResolvedValue(false);
				mockAdapter.write.mockRejectedValue(new Error('Write failed'));

				await expect(store.save(testData)).rejects.toThrow(StorageError);
			});
		});

		describe('clear', () => {
			it('should reset data to default value', async () => {
				mockAdapter.exists.mockResolvedValue(false);

				await store.clear();

				const defaultValue = { id: 'default', name: 'Default', value: 0 };
				expect(mockAdapter.write).toHaveBeenCalledWith(
					'test-data.json',
					JSON.stringify(defaultValue, null, 2)
				);
			});
		});

		describe('delete', () => {
			it('should delete file if it exists', async () => {
				mockAdapter.exists.mockResolvedValue(true);

				await store.delete();

				expect(mockAdapter.remove).toHaveBeenCalledWith('test-data.json');
			});

			it('should not throw if file does not exist', async () => {
				mockAdapter.exists.mockResolvedValue(false);

				await expect(store.delete()).resolves.not.toThrow();
				expect(mockAdapter.remove).not.toHaveBeenCalled();
			});
		});

		describe('protected methods', () => {
			it('should check file existence', async () => {
				mockAdapter.exists.mockResolvedValue(true);

				const exists = await (store as any).fileExists('test.json');

				expect(exists).toBe(true);
				expect(mockAdapter.exists).toHaveBeenCalledWith('test.json');
			});

			it('should return false on existence check error', async () => {
				mockAdapter.exists.mockRejectedValue(new Error('Check failed'));

				const exists = await (store as any).fileExists('test.json');

				expect(exists).toBe(false);
			});
		});
	});

	describe('MultiFileStore', () => {
		let store: TestMultiFileStore;
		let mockVault: jest.Mocked<Vault>;
		let mockPathManager: jest.Mocked<DataPathManager>;
		let mockAdapter: any;

		beforeEach(() => {
			jest.clearAllMocks();

			mockAdapter = {
				exists: jest.fn(),
				read: jest.fn(),
				write: jest.fn(),
				remove: jest.fn(),
				list: jest.fn(),
			};

			mockVault = {
				adapter: mockAdapter,
			} as any;

			mockPathManager = {
				createBackup: jest.fn(),
			} as any;

			store = new TestMultiFileStore(mockVault, mockPathManager, 'test-dir');
		});

		describe('constructor', () => {
			it('should create store with directory path', () => {
				expect(store).toBeInstanceOf(TestMultiFileStore);
				expect(store).toBeInstanceOf(MultiFileStore);
				expect(store).toBeInstanceOf(FileSystemStore);
			});
		});

		describe('getItemFilePath', () => {
			it('should generate file path for item', () => {
				const path = (store as any).getItemFilePath('item-123');
				expect(path).toBe('test-dir/item-123.json');
			});
		});

		describe('loadItem', () => {
			it('should load single item by ID', async () => {
				const testData: TestData = { id: 'item-1', name: 'Item 1', value: 10 };
				mockAdapter.exists.mockResolvedValue(true);
				mockAdapter.read.mockResolvedValue(JSON.stringify(testData));

				const result = await (store as any).loadItem('item-1', null);

				expect(result).toEqual(testData);
				expect(mockAdapter.read).toHaveBeenCalledWith('test-dir/item-1.json');
			});

			it('should return fallback if file does not exist', async () => {
				mockAdapter.exists.mockResolvedValue(false);
				const fallback: TestData = { id: 'fallback', name: 'Fallback', value: 0 };

				const result = await (store as any).loadItem('item-1', fallback);

				expect(result).toEqual(fallback);
			});
		});

		describe('saveItem', () => {
			it('should save single item by ID', async () => {
				const testData: TestData = { id: 'item-1', name: 'Item 1', value: 10 };
				mockAdapter.exists.mockResolvedValue(false);

				await (store as any).saveItem('item-1', testData);

				expect(mockAdapter.write).toHaveBeenCalledWith(
					'test-dir/item-1.json',
					JSON.stringify(testData, null, 2)
				);
			});
		});

		describe('deleteItem', () => {
			it('should delete single item by ID', async () => {
				mockAdapter.exists.mockResolvedValue(true);

				await (store as any).deleteItem('item-1');

				expect(mockAdapter.remove).toHaveBeenCalledWith('test-dir/item-1.json');
			});

			it('should not throw if item does not exist', async () => {
				mockAdapter.exists.mockResolvedValue(false);

				await expect((store as any).deleteItem('item-1')).resolves.not.toThrow();
				expect(mockAdapter.remove).not.toHaveBeenCalled();
			});
		});

		describe('listItemIds', () => {
			it('should list all item IDs', async () => {
				mockAdapter.exists.mockResolvedValue(true);
				mockAdapter.list.mockResolvedValue({
					files: ['test-dir/item-1.json', 'test-dir/item-2.json', 'test-dir/item-3.json'],
					folders: [],
				});

				const ids = await (store as any).listItemIds();

				expect(ids).toEqual(['item-1', 'item-2', 'item-3']);
			});

			it('should filter out non-JSON files', async () => {
				mockAdapter.exists.mockResolvedValue(true);
				mockAdapter.list.mockResolvedValue({
					files: ['test-dir/item-1.json', 'test-dir/readme.md', 'test-dir/item-2.json'],
					folders: [],
				});

				const ids = await (store as any).listItemIds();

				expect(ids).toEqual(['item-1', 'item-2']);
			});

			it('should return empty array if directory does not exist', async () => {
				mockAdapter.exists.mockResolvedValue(false);

				const ids = await (store as any).listItemIds();

				expect(ids).toEqual([]);
			});
		});

		describe('load', () => {
			it('should load all items', async () => {
				mockAdapter.exists.mockResolvedValue(true);
				mockAdapter.list.mockResolvedValue({
					files: ['test-dir/item-1.json', 'test-dir/item-2.json'],
					folders: [],
				});

				const item1: TestData = { id: 'item-1', name: 'Item 1', value: 10 };
				const item2: TestData = { id: 'item-2', name: 'Item 2', value: 20 };

				mockAdapter.read
					.mockResolvedValueOnce(JSON.stringify(item1))
					.mockResolvedValueOnce(JSON.stringify(item2));

				const result = await store.load();

				expect(result).toEqual([item1, item2]);
			});

			it('should return empty array if no items', async () => {
				mockAdapter.exists.mockResolvedValue(false);

				const result = await store.load();

				expect(result).toEqual([]);
			});
		});

		describe('save', () => {
			it('should save all items', async () => {
				const items: TestData[] = [
					{ id: 'item-1', name: 'Item 1', value: 10 },
					{ id: 'item-2', name: 'Item 2', value: 20 },
				];

				mockAdapter.exists.mockResolvedValue(false);
				mockAdapter.list.mockResolvedValue({ files: [], folders: [] });

				await store.save(items);

				expect(mockAdapter.write).toHaveBeenCalledTimes(2);
				expect(mockAdapter.write).toHaveBeenCalledWith(
					'test-dir/item-1.json',
					JSON.stringify(items[0], null, 2)
				);
				expect(mockAdapter.write).toHaveBeenCalledWith(
					'test-dir/item-2.json',
					JSON.stringify(items[1], null, 2)
				);
			});

			it('should clear existing items before saving', async () => {
				const items: TestData[] = [{ id: 'new-item', name: 'New', value: 30 }];

				mockAdapter.exists.mockResolvedValue(true);
				mockAdapter.list.mockResolvedValue({
					files: ['test-dir/old-item.json'],
					folders: [],
				});

				await store.save(items);

				expect(mockAdapter.remove).toHaveBeenCalledWith('test-dir/old-item.json');
				expect(mockAdapter.write).toHaveBeenCalledTimes(1);
			});

			it('should throw StorageError if validation fails', async () => {
				const invalidData = 'not an array' as any;

				await expect(store.save(invalidData)).rejects.toThrow(StorageError);
			});
		});

		describe('clear', () => {
			it('should delete all files', async () => {
				mockAdapter.exists.mockResolvedValue(true);
				mockAdapter.list.mockResolvedValue({
					files: ['test-dir/item-1.json', 'test-dir/item-2.json', 'test-dir/item-3.json'],
					folders: [],
				});

				await store.clear();

				expect(mockAdapter.remove).toHaveBeenCalledTimes(3);
				expect(mockAdapter.remove).toHaveBeenCalledWith('test-dir/item-1.json');
				expect(mockAdapter.remove).toHaveBeenCalledWith('test-dir/item-2.json');
				expect(mockAdapter.remove).toHaveBeenCalledWith('test-dir/item-3.json');
			});

			it('should not throw if directory is empty', async () => {
				mockAdapter.exists.mockResolvedValue(false);

				await expect(store.clear()).resolves.not.toThrow();
			});
		});

		describe('protected methods', () => {
			it('should list files in directory', async () => {
				mockAdapter.exists.mockResolvedValue(true);
				mockAdapter.list.mockResolvedValue({
					files: ['file1.json', 'file2.json'],
					folders: [],
				});

				const files = await (store as any).listFiles('test-dir');

				expect(files).toEqual(['file1.json', 'file2.json']);
			});

			it('should throw StorageError on list failure', async () => {
				mockAdapter.exists.mockResolvedValue(true);
				mockAdapter.list.mockRejectedValue(new Error('List failed'));

				await expect((store as any).listFiles('test-dir')).rejects.toThrow(StorageError);
			});
		});
	});
});
