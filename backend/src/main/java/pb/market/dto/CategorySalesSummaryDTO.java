package pb.market.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CategorySalesSummaryDTO {
    private BigDecimal totalRevenue;
    private long totalUnitsSold;
    private BigDecimal totalCost;
    private BigDecimal totalProfit;
    private double overallProfitMargin;
    private List<CategorySalesDTO> categories;
}
