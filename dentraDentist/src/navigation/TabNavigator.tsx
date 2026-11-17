import { useGetConsultationCasesQuery } from '../store/dentraApi';
import { useForegroundRefresh } from '../common/hooks/useForegroundRefresh';
import { MessagesScreen } from '../features/messages/MessagesScreen';
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  CalendarDays,
  MessageCircle,
  House,
  UserRound,
  UsersRound,
} from 'lucide-react-native';
import { colors } from '../common/theme/theme';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { ScheduleScreen } from '../features/schedule/ScheduleScreen';
import { TodayScreen } from '../features/today/TodayScreen';
import { PatientsScreen } from '../features/patients/PatientsScreen';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

type TabIconProps = {
  color: string;
  size: number;
};

function TodayIcon(props: TabIconProps) {
  return <House {...props} />;
}

function ScheduleIcon(props: TabIconProps) {
  return <CalendarDays {...props} />;
}

function ProfileIcon(props: TabIconProps) {
  return <UserRound {...props} />;
}

function MessagesIcon(props: TabIconProps) {
  return <MessageCircle {...props} />;
}

function PatientsIcon(props: TabIconProps) {
  return <UsersRound {...props} />;
}

export function TabNavigator() {
  const inbox = useGetConsultationCasesQuery({ page: 1, filter: 'all' });
  useForegroundRefresh(inbox.refetch, true, 10000);
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
        },
      }}
    >
      <Tab.Screen
        name="Today"
        component={TodayScreen}
        options={{ tabBarIcon: TodayIcon }}
      />
      <Tab.Screen
        name="Schedule"
        component={ScheduleScreen}
        options={{ tabBarIcon: ScheduleIcon }}
      />
      <Tab.Screen
        name="Patients"
        component={PatientsScreen}
        options={{ tabBarIcon: PatientsIcon }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{
          tabBarIcon: MessagesIcon,
          tabBarBadge: inbox.data?.unreadCount || undefined,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: ProfileIcon }}
      />
    </Tab.Navigator>
  );
}
