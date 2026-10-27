import React from 'react';
import Analytics from './Analytics';

/**
 * BranchAnalytics
 * 
 * Renders the full executive Performance Analytics & P&L interface identical to Admin Analytics,
 * strictly scoped to the branch (either passed explicitly via prop branchId or determined
 * from the authenticated branch user session).
 */
const BranchAnalytics = ({ branchId, branchName }) => {
    return <Analytics branchId={branchId} branchName={branchName} />;
};

export default BranchAnalytics;
