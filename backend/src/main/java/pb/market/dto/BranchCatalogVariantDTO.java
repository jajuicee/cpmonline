package pb.market.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Catalog representation exposed strictly to branches.
 * Cost prices (acquisitionPrice, costPerUnit, etc.) are INTENTIONALLY EXCLUDED
 * to prevent any cost price leakage to branch users.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BranchCatalogVariantDTO {
    private Long variantId;
    private Long productId;
    private String brandName;
    private String modelName;
    private String category;
    private String sku;
    private String color;
    private String shape;
    private Integer thicknessMm;
    private BigDecimal sellingPrice;
    private Long masterStock;
    private Long branchStock;
}
