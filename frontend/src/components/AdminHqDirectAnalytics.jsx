import React from 'react';
import Analytics from './Analytics';

/**
 * AdminHqDirectAnalytics
 * 
 * Renders the full executive Performance Analytics & P&L interface identical to Branch Analytics,
 * strictly catered to Central HQ / Main Admin operations and Consignees.
 */
const AdminHqDirectAnalytics = () => {
    return <Analytics branchId="HQ" branchName="Main Admin (Central HQ & Consignees)" />;
};

export default AdminHqDirectAnalytics;
