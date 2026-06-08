import { Tabs, usePathname, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { colors, fonts, fontSizes, radius, shadows, spacing } from '../../src/theme';

const WIDE_BREAKPOINT = 768;

type NavItem = { label: string; path: string; icon: keyof typeof Ionicons.glyphMap };

const NAV_ITEMS: NavItem[] = [
  { label: 'Subastas', path: '/', icon: 'hammer-outline' },
  { label: 'Catalogo', path: '/catalogo', icon: 'grid-outline' },
  { label: 'Vender', path: '/vender', icon: 'add-circle-outline' },
  { label: 'Perfil', path: '/perfil', icon: 'person-outline' },
];

function TopNavbar() {
  const pathname = usePathname();
  const isActive = (path: string) =>
    path === '/' ? pathname === '/' || pathname === '/index' : pathname.startsWith(path);

  return (
    <View style={[styles.navbar, shadows.sm]}>
      <TouchableOpacity style={styles.brand} onPress={() => router.push('/')} accessibilityRole="button">
        <Image source={require('../../assets/logo.png')} style={styles.brandLogo} resizeMode="contain" />
        <Text style={styles.brandName}>Subastas Premium</Text>
      </TouchableOpacity>

      <View style={styles.links}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.path);
          return (
            <TouchableOpacity
              key={item.path}
              style={[styles.link, active && styles.linkActive]}
              onPress={() => router.push(item.path as never)}
              accessibilityRole="button"
            >
              <Ionicons name={item.icon} size={18} color={active ? colors.ink : colors.textSecondary} />
              <Text style={[styles.linkText, active && styles.linkTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;

  return (
    <View style={{ flex: 1, backgroundColor: colors.ivory }}>
      {isWide && <TopNavbar />}
      <Tabs
        screenOptions={{
          headerShown: !isWide,
          tabBarActiveTintColor: colors.auctionGold,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: isWide
            ? { display: 'none' }
            : { backgroundColor: colors.ivory, borderTopColor: colors.border },
          headerStyle: { backgroundColor: colors.ivory },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontFamily: fonts.headingSemibold, color: colors.textPrimary },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Subastas',
            tabBarIcon: ({ color, size }) => <Ionicons name="hammer-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="catalogo"
          options={{
            title: 'Catalogo',
            tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="vender"
          options={{
            title: 'Vender',
            tabBarIcon: ({ color, size }) => <Ionicons name="add-circle-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="perfil"
          options={{
            title: 'Perfil',
            tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.ivory,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.lg,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandLogo: { width: 36, height: 36 },
  brandName: { fontFamily: fonts.display, fontSize: fontSizes.xl, color: colors.textPrimary },
  links: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
  },
  linkActive: { backgroundColor: colors.auctionGold },
  linkText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.textSecondary },
  linkTextActive: { color: colors.ink, fontFamily: fonts.bodySemibold },
});
