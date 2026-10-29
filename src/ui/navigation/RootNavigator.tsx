import {
  Component,
  type PropsWithChildren,
  useMemo,
  useEffect,
  useState,
  useRef,
} from 'react';
import { View, StyleSheet } from 'react-native';
import {
  CommonActions,
  DefaultTheme,
  NavigationContainer,
  StackActions,
  createNavigationContainerRef,
  useIsFocused,
  type RouteProp,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { AppNavProvider, type AppNav, type TabName } from '@features/nav';
import {
  ShelfScreen,
  BookMapScreen,
  ParseProgressScreen,
  ImportSettingsScreen,
} from '@features/library/LibraryScreens';
import {
  ReviewScreen,
  ReviewSessionScreen,
} from '@features/review/ReviewScreens';
import {
  NotesScreen,
  NotesBookScreen,
  NoteDetailScreen,
} from '@features/notes/NotesScreens';
import {
  MeScreen,
  MeMineruScreen,
  MeAIScreen,
  MeAIEditScreen,
  MePrefsScreen,
  MeStorageScreen,
  AboutScreen,
} from '@features/settings/SettingsScreens';
import { useReviewBadge } from '@features/review/useReviewBadge';
import {
  StudyScreen,
  ReaderScreen,
  SectionDoneScreen,
} from '@features/study/StudyScreens';
import { AppearanceScreen } from '@features/appearance/AppearanceScreen';
import { GalleryScreen } from '@features/gallery/GalleryScreen';
import {
  TodayScreen,
  AskShelfScreen,
  LearningStatsScreen,
  WelcomeScreen,
  Win11SetupGate,
} from '@features/home/HomeScreens';
import { Button, Empty, Screen, TabBar, useSkin, useTokens } from '@ui/kit';

export type RootStackParams = {
  Tabs: { screen?: TabName } | undefined;
  BookMap: { bookId: string };
  ParseProgress: { bookId: string };
  ImportSettings: { draftId: string };
  Study: {
    bookId: string;
    mode?: 'read' | 'listen';
    sectionId?: string;
    blockRef?: string;
    question?: string;
    stuckId?: number;
  };
  Reader: { bookId: string; sectionId?: string; blockRef?: string };
  SectionDone: { bookId: string; sectionId: string; draftId: string };
  ReviewSession: undefined;
  NotesBook: { bookId: string };
  NoteDetail: { bookId: string; sectionId: string };
  MeMineru: undefined;
  MeAI: undefined;
  MeAIEdit: { providerId?: string };
  MePrefs: undefined;
  MeAppearance: undefined;
  MeStorage: undefined;
  About: undefined;
  SkinGallery: undefined;
  AskShelf: undefined;
  LearningStats: undefined;
  Welcome: undefined;
};
const Stack = createNativeStackNavigator<RootStackParams>();
const Tabs = createBottomTabNavigator<Record<TabName, undefined>>();
const navRef = createNavigationContainerRef<RootStackParams>();
const tabItems = [
  { key: 'Shelf', label: '书架', icon: 'shelf' as const },
  { key: 'Review', label: '复习', icon: 'cards' as const },
  { key: 'Notes', label: '笔记', icon: 'note' as const },
  { key: 'Me', label: '我的', icon: 'person' as const },
];

class ScreenBoundary extends Component<PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <Screen>
        <Empty
          title="页面暂时无法显示"
          body="请重试打开，已保存的学习记录仍在。"
          action={
            <Button
              label="重试"
              onPress={() => this.setState({ failed: false })}
            />
          }
        />
      </Screen>
    ) : (
      this.props.children
    );
  }
}
function ShelfTab() {
  return (
    <ScreenBoundary>
      <ShelfScreen />
    </ScreenBoundary>
  );
}
function TodayTab() {
  return (
    <ScreenBoundary>
      <TodayScreen />
    </ScreenBoundary>
  );
}
function ReviewTab() {
  return (
    <ScreenBoundary>
      <ReviewScreen />
    </ScreenBoundary>
  );
}
function NotesTab() {
  return (
    <ScreenBoundary>
      <NotesScreen />
    </ScreenBoundary>
  );
}
function MeTab() {
  return (
    <ScreenBoundary>
      <MeScreen />
    </ScreenBoundary>
  );
}
function MainTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const t = useTokens();
  const due = useReviewBadge();
  const items =
    t.brand?.kind === 'win11'
      ? [{ key: 'Today', label: '今天', icon: 'home' as const }, ...tabItems]
      : tabItems;
  useEffect(() => {
    if (t.brand?.kind !== 'win11' && state.routes[state.index].name === 'Today')
      navigation.navigate('Shelf');
  }, [navigation, state, t.brand?.kind]);
  return (
    <View
      style={
        t.layout.groupedLists
          ? StyleSheet.create({
              root: { position: 'absolute', left: 0, right: 0, bottom: 0 },
            }).root
          : { paddingBottom: insets.bottom, backgroundColor: t.color.surface }
      }
    >
      <TabBar
        items={items.map(item =>
          item.key === 'Review' && due > 0 ? { ...item, badge: due } : item,
        )}
        active={state.routes[state.index].name}
        onSelect={key => {
          const route = state.routes.find(value => value.name === key);
          if (!route) return;
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!event.defaultPrevented) navigation.navigate(route.name);
        }}
      />
    </View>
  );
}
const renderTabBar = (props: BottomTabBarProps) => <MainTabBar {...props} />;
const hiddenTabBar = () => null;
function MainTabs() {
  const t = useTokens();
  const focused = useIsFocused();
  return (
    <Tabs.Navigator
      initialRouteName={t.brand?.kind === 'win11' ? 'Today' : 'Shelf'}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: t.color.bg },
      }}
      tabBar={focused ? renderTabBar : hiddenTabBar}
    >
      <Tabs.Screen name="Today" component={TodayTab} />
      <Tabs.Screen name="Shelf" component={ShelfTab} />
      <Tabs.Screen name="Review" component={ReviewTab} />
      <Tabs.Screen name="Notes" component={NotesTab} />
      <Tabs.Screen name="Me" component={MeTab} />
    </Tabs.Navigator>
  );
}

type RootRoute = {
  [K in keyof RootStackParams]: RouteProp<RootStackParams, K>;
}[keyof RootStackParams];
function Page({
  route: untypedRoute,
  navigation,
}: NativeStackScreenProps<RootStackParams>) {
  const route = untypedRoute as RootRoute;
  const back = () => navigation.goBack();
  switch (route.name) {
    case 'BookMap':
      return <BookMapScreen bookId={route.params.bookId} />;
    case 'AskShelf':
      return <AskShelfScreen />;
    case 'LearningStats':
      return <LearningStatsScreen />;
    case 'Welcome':
      return <WelcomeScreen />;
    case 'ParseProgress':
      return <ParseProgressScreen bookId={route.params.bookId} />;
    case 'ImportSettings':
      return <ImportSettingsScreen draftId={route.params.draftId} />;
    case 'ReviewSession':
      return <ReviewSessionScreen />;
    case 'NotesBook':
      return <NotesBookScreen bookId={route.params.bookId} />;
    case 'NoteDetail':
      return (
        <NoteDetailScreen
          bookId={route.params.bookId}
          sectionId={route.params.sectionId}
        />
      );
    case 'MeMineru':
      return <MeMineruScreen />;
    case 'MeAI':
      return <MeAIScreen />;
    case 'MeAIEdit':
      return <MeAIEditScreen providerId={route.params?.providerId} />;
    case 'MePrefs':
      return <MePrefsScreen />;
    case 'MeAppearance':
      return <AppearanceScreen back={back} />;
    case 'MeStorage':
      return <MeStorageScreen />;
    case 'About':
      return <AboutScreen />;
    case 'SkinGallery':
      return (
        <GalleryScreen
          appearance={() => navigation.navigate('MeAppearance')}
          fontScale={1}
          onScale={() => {}}
        />
      );
    case 'Study':
      return <StudyScreen {...route.params} />;
    case 'Reader':
      return <ReaderScreen {...route.params} />;
    case 'SectionDone':
      return <SectionDoneScreen {...route.params} />;
    default:
      return null;
  }
}
const screens = [
  'BookMap',
  'ParseProgress',
  'ImportSettings',
  'Study',
  'Reader',
  'SectionDone',
  'ReviewSession',
  'NotesBook',
  'NoteDetail',
  'MeMineru',
  'MeAI',
  'MeAIEdit',
  'MePrefs',
  'MeAppearance',
  'MeStorage',
  'About',
  'SkinGallery',
  'AskShelf',
  'LearningStats',
  'Welcome',
] as const;
export function RootNavigator({
  enterDemo,
  exitDemo,
  fontScale,
  onScale,
  incomingImport,
}: {
  enterDemo(): void;
  exitDemo(): void;
  fontScale: number;
  onScale(value: number): void;
  incomingImport?: {
    token: number;
    selection:
      | { kind: 'draft'; draftId: string }
      | { kind: 'duplicate'; bookId: string };
  } | null;
}) {
  const [ready, setReady] = useState(false);
  const appliedImport = useRef<number | null>(null);
  useEffect(() => {
    if (
      !ready ||
      !incomingImport ||
      appliedImport.current === incomingImport.token
    )
      return;
    appliedImport.current = incomingImport.token;
    const selection = incomingImport.selection;
    navRef.dispatch(
      CommonActions.navigate(
        selection.kind === 'draft' ? 'ImportSettings' : 'BookMap',
        selection.kind === 'draft'
          ? { draftId: selection.draftId }
          : { bookId: selection.bookId },
      ),
    );
  }, [ready, incomingImport]);
  const { skin, tokens } = useSkin();
  const navigation = useMemo<AppNav>(
    () => ({
      open(route) {
        if (!navRef.isReady()) return;
        if (route.name === 'Tabs')
          navRef.dispatch(
            CommonActions.navigate(
              'Tabs',
              route.tab ? { screen: route.tab } : undefined,
            ),
          );
        else {
          const { name, ...params } = route;
          navRef.dispatch(CommonActions.navigate(name, params));
        }
      },
      replace(route) {
        if (!navRef.isReady()) return;
        const { name, ...params } = route;
        navRef.dispatch(
          StackActions.replace(
            name,
            route.name === 'Tabs' ? { screen: route.tab } : params,
          ),
        );
      },
      back() {
        if (navRef.canGoBack()) navRef.goBack();
      },
      enterDemo,
      exitDemo,
    }),
    [enterDemo, exitDemo],
  );
  const theme = { ...DefaultTheme, ...skin.navigationTheme(tokens) };
  return (
    <AppNavProvider value={navigation}>
      <Win11SetupGate ready={ready} />
      <NavigationContainer
        ref={navRef}
        theme={theme}
        onReady={() => setReady(true)}
      >
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: tokens.color.bg },
          }}
        >
          <Stack.Screen name="Tabs" component={MainTabs} />
          {screens.map(name =>
            name === 'SkinGallery' ? (
              <Stack.Screen key={name} name={name}>
                {({ navigation: pageNav }) => (
                  <GalleryScreen
                    appearance={() => pageNav.navigate('MeAppearance')}
                    fontScale={fontScale}
                    onScale={onScale}
                  />
                )}
              </Stack.Screen>
            ) : (
              <Stack.Screen key={name} name={name} component={Page} />
            ),
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AppNavProvider>
  );
}
