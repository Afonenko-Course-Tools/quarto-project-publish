import { DOCUMENT_MODE } from './html.d.ts';
import type { DoctypeToken } from './token.d.ts';
export declare function isConforming(token: DoctypeToken): boolean;
export declare function getDocumentMode(token: DoctypeToken): DOCUMENT_MODE;
