import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Search, ChevronLeft, ChevronRight, UserCheck, 
  UserX, Eye, X, Mail, Smartphone, Award, Shield, Activity
} from 'lucide-react';
import { adminService } from '../services/api';
import toast from 'react-hot-toast';

export default function AdminUsers() {
    const [users, setUsers] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [userDetail, setUserDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [updating, setUpdating] = useState(false);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data } = await adminService.getUsers({ page, limit: 12, role: roleFilter, search });
            setUsers(data.users || []);
            setTotal(data.total || 0);
            setPages(data.pages || 1);
        } catch (err) {
            toast.error('Failed to load user database');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(fetchUsers, 400);
        return () => clearTimeout(timer);
    }, [page, roleFilter, search]);

    const handleUpdateRole = async (userId, newRole) => {
        setUpdating(true);
        try {
            await adminService.updateUserRole(userId, newRole); // Backend should have this or combine with updateStatus
            toast.success(`Role updated to ${newRole}`);
            if (userDetail?._id === userId) {
                setUserDetail({ ...userDetail, role: newRole });
            }
            fetchUsers();
        } catch (err) {
            toast.error('Role update failed');
        } finally {
            setUpdating(false);
        }
    };

    const handleToggleStatus = async (user) => {
        try {
            await adminService.updateUserStatus(user._id, !user.isActive);
            toast.success(`User ${user.isActive ? 'Deactivated' : 'Activated'}`);
            if (userDetail?._id === user._id) {
                setUserDetail({ ...userDetail, isActive: !user.isActive });
            }
            fetchUsers();
        } catch (err) {
            toast.error('Status sync failed');
        }
    };

    const viewDetails = async (user) => {
        setDetailLoading(true);
        setUserDetail(user); // Quick show base info
        try {
            const { data } = await adminService.getUserDetails(user._id);
            setUserDetail(data.user || user); // fallback if backend wrap differs
        } catch (err) {
            console.error('Detail fetch error:', err);
        } finally {
            setDetailLoading(false);
        }
    };

    return (
        <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto font-sans">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">User Registry</h1>
                    <p className="text-slate-500 text-sm">{total} total system identities recorded</p>
                </div>
                
                <div className="flex bg-white p-1 rounded-xl border border-slate-100 shadow-sm overflow-x-auto whitespace-nowrap">
                    {['', 'patient', 'doctor', 'admin', 'client'].map((role) => (
                        <button
                            key={role}
                            onClick={() => { setRoleFilter(role); setPage(1); }}
                            className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${roleFilter === role ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-800'}`}
                        >
                            {role || 'Universal'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                    type="text"
                    placeholder="Search by name, email or identifier..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-sm focus:border-blue-500 outline-none shadow-sm transition-all"
                />
            </div>

            {/* Simple Tabular Layout */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
                {loading ? (
                    <div className="flex items-center justify-center h-[400px]">
                        <div className="w-8 h-8 border-3 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50">
                                <tr className="border-b border-slate-50">
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Identify</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Authority</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {users.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-20 text-center text-slate-400 text-sm font-medium">No users found in database</td>
                                    </tr>
                                ) : (
                                    users.map((u) => (
                                        <tr key={u._id} className="hover:bg-slate-50/50 transition-all">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs">
                                                        {u.name?.[0]?.toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-800">{u.name}</p>
                                                        <p className="text-[10px] text-slate-400 italic lowercase">{u.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                                                    u.role === 'admin' ? 'bg-red-50 text-red-600 border-red-100' :
                                                    u.role === 'doctor' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                    'bg-slate-100 text-slate-600 border-slate-200'
                                                }`}>
                                                    {u.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                                    <span className={`text-[10px] font-bold uppercase ${u.isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                        {u.isActive ? 'Active' : 'Suspended'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => viewDetails(u)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleToggleStatus(u)} className={`p-2 rounded-lg transition-all ${u.isActive ? 'text-slate-400 hover:text-red-600 hover:bg-red-50' : 'text-emerald-400 hover:text-white hover:bg-emerald-500'}`}>
                                                        {u.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                <div className="px-6 py-4 border-t border-slate-50 flex items-center justify-between text-xs">
                    <p className="text-slate-400 font-medium">Page {page} of {pages}</p>
                    <div className="flex gap-2">
                        <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg disabled:opacity-30">Previous</button>
                        <button disabled={page === pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg disabled:opacity-30">Next</button>
                    </div>
                </div>
            </div>

            {/* Profile Detail Drawer (Simple Version) */}
            <AnimatePresence>
                {userDetail && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-end overflow-hidden">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setUserDetail(null)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" />
                        <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="relative bg-white w-full max-w-md h-full shadow-2xl flex flex-col">
                            
                            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                                <h2 className="font-bold text-slate-800">User Identity Profile</h2>
                                <button onClick={() => setUserDetail(null)} className="p-2 hover:bg-slate-50 rounded-lg transition-all"><X className="w-5 h-5 text-slate-400" /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-white text-2xl font-bold">
                                        {userDetail.name?.[0]?.toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900 leading-tight">{userDetail.name}</h3>
                                        <p className="text-sm text-slate-500 lowercase">{userDetail.email}</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Authority Control</p>
                                   <div className="grid grid-cols-2 gap-2">
                                       {['patient', 'client', 'doctor', 'admin'].map(r => (
                                           <button 
                                                key={r} 
                                                onClick={() => handleUpdateRole(userDetail._id, r)}
                                                disabled={userDetail.role === r || updating}
                                                className={`py-2 rounded-xl text-xs font-bold border transition-all ${userDetail.role === r ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'}`}
                                           >
                                               {r.charAt(0).toUpperCase() + r.slice(1)}
                                           </button>
                                       ))}
                                   </div>
                                </div>

                                <div className="space-y-4">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contact Information</p>
                                    <div className="space-y-2">
                                        <div className="flex gap-4 p-3.5 bg-slate-50 rounded-xl">
                                            <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                                            <p className="text-xs font-bold text-slate-700 truncate">{userDetail.email}</p>
                                        </div>
                                        <div className="flex gap-4 p-3.5 bg-slate-50 rounded-xl">
                                            <Smartphone className="w-4 h-4 text-slate-400 shrink-0" />
                                            <p className="text-xs font-bold text-slate-700">{userDetail.phone || 'No mobile linked'}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Health Metadata</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                            <p className="text-[8px] font-bold text-slate-400 uppercase mb-1">Gender</p>
                                            <p className="text-xs font-bold text-slate-700">{userDetail.profile?.gender || '--'}</p>
                                        </div>
                                        <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                            <p className="text-[8px] font-bold text-slate-400 uppercase mb-1">Age</p>
                                            <p className="text-xs font-bold text-slate-700">{userDetail.profile?.age || '--'}</p>
                                        </div>
                                        <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                            <p className="text-[8px] font-bold text-slate-400 uppercase mb-1">Goal</p>
                                            <p className="text-xs font-bold text-slate-700">{userDetail.nutritionGoal?.goal || 'General'}</p>
                                        </div>
                                        <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                            <p className="text-[8px] font-bold text-slate-400 uppercase mb-1">Member Since</p>
                                            <p className="text-xs font-bold text-slate-700">{new Date(userDetail.createdAt).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-slate-50 border-t border-slate-100">
                                <button 
                                    onClick={() => handleToggleStatus(userDetail)}
                                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all shadow-sm ${userDetail.isActive ? 'bg-white text-red-600 border border-red-50 hover:bg-red-50' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                                >
                                    {userDetail.isActive ? 'Suspend Identity' : 'Restore Identity'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
