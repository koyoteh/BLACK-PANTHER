export async function getDeviceMode() {
    const val = (process.env.DEVICE || 'default').toLowerCase().trim();
    return val === 'ios' ? 'ios' : 'android';
}
