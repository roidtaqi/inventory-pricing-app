import { describe, expect, it } from 'vitest';
import { ApprovalService } from '../ApprovalService';

describe('ApprovalService', () => {
  it('should activate approved price when effective date is today', () => {
    const status = ApprovalService.resolveApprovedStatus('2026-06-09', new Date(2026, 5, 9));
    expect(status).toBe('ACTIVE');
  });

  it('should schedule approved price when effective date is in the future', () => {
    const status = ApprovalService.resolveApprovedStatus('2026-06-10', new Date(2026, 5, 9));
    expect(status).toBe('SCHEDULED');
  });

  it('should require effective date before submitting approval', () => {
    const error = ApprovalService.canSubmitForApproval({
      effectiveDate: undefined,
      recommendedPrice: 13000,
    });

    expect(error).toBe('Tanggal berlaku wajib diisi saat mengajukan approval.');
  });
});
