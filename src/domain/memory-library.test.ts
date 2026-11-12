import { libraryContract } from './library-contract'
import { memoryLibrary } from './memory-library'

libraryContract('memory', () => memoryLibrary())
