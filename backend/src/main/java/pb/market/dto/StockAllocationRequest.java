package pb.market.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Request body for POST /api/admin/allocations
 * Admin uses this to push stock from the main (admin) inventory to a branch.
 */
@Data
public class StockAllocationRequest {

    /** Target branch to receive the stock */
    private Long branchId;

    /** Payment deadline set by admin (applies to all items in this batch) */
    private LocalDate deadline;

    /** Optional notes for this allocation session */
    private String notes;

    /** List of items to allocate */
    private List<AllocationItem> items;

    @Data
    public static class AllocationItem {
        /** The variant to transfer */
        private Long variantId;

        /** Number of units to move from admin → branch */
        private Integer quantity;

        /** Price per unit the branch will owe */
        private BigDecimal costPerUnit;
    }
}
