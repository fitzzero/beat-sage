Goals:

- Create a base NextJS layout
- Create some global components
- Establish a clean pattern for creating components tied to public service methods
- Utilize Material and NextJS modern and best practices
- useSubscription useServiceMethod allow components to independently subscribe to the same server state without having to pass data throughout the whole hiearchy. Utilize this when possible to keep prop trees lighter
- Create component specific rules to maintain consistency

Patterns:
// ❌ Don't use direct colors
<Box sx={{ color: '#FF3B30', backgroundColor: '#1976d2' }}>

// ✅ Modern Pattern
<Box sx={{ color: 'error.main', bgcolor: 'primary.main' }}>

// ❌ Don't hard code spacing
<Box sx={{
  paddingLeft: 16,
  paddingRight: 16,
  '@media (max-width: 600px)': { paddingLeft: 8 }
}}>

// ✅ Modern Pattern
<Box sx={{ px: { xs: 1, sm: 2 } }}>

// ❌ Don't hard code Typography

<h1>Page Title</h1>
<Typography sx={{ fontSize: '18px', fontWeight: 600 }}>

// ✅ Modern Pattern
<Typography variant="h1">Page Title</Typography>
<Typography variant="h5">Subtitle</Typography>

// ❌ If majority of components use the same props, standardize it
<TextField fullWidth variant="outlined" />
<TextField fullWidth variant="outlined" />
<TextField fullWidth variant="outlined" />

// ✅ Modern Pattern - Set defaults in theme
const theme = createTheme({
components: {
MuiTextField: {
defaultProps: {
fullWidth: true,
variant: 'outlined'
}
}
}
})

// Now you can just use:
<TextField />

// ❌ Don't re-render expensive logic when it's not needed (useMemo)
const ExpensiveComponent = ({ data, onUpdate }) => {
const processedData = expensiveCalculation(data)
return <div>{processedData}</div>
}

// ✅ Modern Pattern - Memoized component
const ExpensiveComponent = React.memo(({ data, onUpdate }) => {
const processedData = useMemo(() => expensiveCalculation(data), [data])
return <div>{processedData}</div>
})

When TO use memo:

    Simple wrapper components with stable props
    Components that re-render often with identical props
    Components with expensive rendering logic
    Child components of frequently updating parents

When NOT to use memo:

    Components with event handlers as props (onClick, onChange, etc.)
    Components with frequently changing state props (isSelected, isFiltered, etc.)
    Components with "always new" objects/arrays as props
    Components that rarely re-render anyway

// ❌ Don't hardcode break points
<Box sx={{
  '@media (max-width: 600px)': {
    padding: 8
  },
  '@media (min-width: 601px)': {
    padding: 16
  }
}}>

// ✅ Modern Pattern - Theme-based responsive design
<Box sx={{
  p: { xs: 1, sm: 2, md: 3 }
}}>

// Or using theme breakpoints directly
<Box sx={(theme) => ({
[theme.breakpoints.down('sm')]: {
padding: theme.spacing(1)
},
[theme.breakpoints.up('sm')]: {
padding: theme.spacing(2)
}
})}>

// ❌ Legacy Pattern - Array indices as keys
{items.map((item, index) => (
<ListItem key={index}>
<ListItemText primary={item.name} />
</ListItem>
))}

// ✅ Modern Pattern - Stable, unique keys
{items.map((item) => (
<ListItem key={item.id}>
<ListItemText primary={item.name} />
</ListItem>
))}

// For dynamic lists with no ID, create a stable key:
{items.map((item) => (
<ListItem key={`${item.name}-${item.category}`}>
<ListItemText primary={item.name} />
</ListItem>
))}

Deliverables:

- Rework the GlobalTopMenu to instead be `GlobalSideMenu` that will be a left-side Drawer instead of a TopAppBar
  - Create easy hook `useIsMobile` that wraps the MUI Theme method to determine if viewport is current mobile or not (isMobile = useIsMobile)
  - IF !isMobile, then SideMenu is permanent and expanded; content is offset to the right by the drawer width
  - IF isMobile, then SideMenu uses a Swipeable Drawer that opens on user gesture/swipe from left -> right
    - Include a subtle left-edge indicator ("sidey") that can also be clicked to open
  - Add the app logo `client/public/logo.png` + app name "Beat Sage" to the top of the Drawer
  - Route model and ACLs
    - Define a strongly typed route config so navigation is data-driven
    - Gate routes with a small ACL predicate that reads the current user ACL
  - Create an array of Routes + Sub-Routes:
    - Home
    - Chat
    - Dashboard (Admin only section)
      - Health (>= Moderator on `userService`)
      - Models (>= Moderator on `modelService`)
      - Agents (>= Moderator on `agentService`)
      - Users (>= Moderator on `userService`)
      - Chats (>= Moderator on `chatService`)
  - Render routes as vertical accordion navigation items (this container flex-grows to fill the space between Branding at the top and User info at the bottom)
    - Accordion Summary (e.g., "Chat") navigates to the section root on click
    - Sub-routes (e.g., "Users") are nested under "Dashboard" and navigate on click
    - Use `next/link` with `ListItemButton component={Link}` for accessible navigation
  - The 3 most recent user chats will eventually be under the Chat accordion; for now just the primary "Chat"
  - At the bottom of the Drawer move the `CurrentUserAvatar` component, include the Display Name to the right
    - Avatar + Name Text should be a single clickable text Button
    - Clicking opens a user menu with two items: Profile, Logout
- Update MainLayout
  - Main content is wrapped in a single Material `Container` (default `maxWidth="md"`)
  - IF !isMobile: content is centered within the remaining space to the right of the permanent Drawer
  - IF isMobile: content is full-width; the Drawer overlays content when open
- MainLayout Background
  - Rendered in a fixed/absolute position under the entire MainLayout I'd like to add a custom background
  - Utilize the 'LightRay' code from this snippet (`https://www.reactbits.dev/backgrounds/light-rays`)
    - Requires the lightweight web-gl package `ogl` added to client (`yarn workspace @beatsage/client add ogl`)
    - Background component should lazy-load the effect and fail gracefully on unsupported devices

Style:

- Prefer to apply style globally in the theme.ts file
- Material primary.main color = '#7f5af0'
- Material secondary.main color = '#72757e'
- Material background color = '#16161a'
- Material primary.text color = '#fffffe'
- Material secondary.text color = '#94a1b2'
- Material divider/stroke/border color = '#010101'
- I believe Material should auto calculate everything else (ie primary.light based on primary.main) so we shouldn't need to define anything else on the palette
- Material spacing = 8px
- Material border radius = 8px
- Utilize the google font 'Space Grotesk' and apply it to Material Theme
- Utilize <Card>'s for primary containers when applicable

Animation:

- I prefer animations to be defined globally before applied so they can be applied consistent
- When using animation, use ones that are smooth on hardware and focus on subtle breathing / color / opacity rather than motion

Implementation Notes (concrete specs):

- Drawer

  - Width: use theme spacing to avoid hardcoded px. `const drawerUnits = 30; const drawerWidth = theme.spacing(drawerUnits)` (30 x 8 = 240px)
  - Desktop: `variant="permanent"`, paper uses `background.paper` and `divider` from theme
  - Mobile: `SwipeableDrawer` controlled by `open` state; add a 8–12px clickable left-edge indicator always visible

- Route config shape

  - Type:
    ```ts
    type NavItem = {
      label: string;
      href: string;
      icon?: React.ReactNode;
      children?: NavItem[];
      isVisible?: (user?: User | null) => boolean; // ACL gate
    };
    ```
  - Use `isVisible` for ACL gating; default to visible if undefined

- ACL helper

  - Minimal helper `hasServiceAcl(user, serviceName, minLevel)` where `minLevel` in { Read, Moderate, Admin }
  - For now, rely on `user.acl` shape from `@shared/types`

- MainLayout

  - Renders the Drawer and a `Container maxWidth="md"`
  - `Container` gets `sx={{ ml: !isMobile ? drawerWidth : 0, py: 2 }}`
  - Background component is absolutely positioned under the layout (z-index below content)

- Theme

  - Apply `Space Grotesk` via `next/font/google` in `app/layout.tsx` and set `theme.typography.fontFamily` to include it
  - Set default props globally for components used often (e.g., `MuiTextField.defaultProps = { fullWidth: true, variant: 'outlined' }`)
  - Keep additional customization minimal and centralized

- Navigation rendering

  - Use `Accordion` for sections; `AccordionSummary` links to parent `href`
  - `ListItemButton component={Link}` for child routes; derive `selected` state via `usePathname()`
  - Avoid inline hard-coded colors/breakpoints; prefer theme tokens and `sx` objects

- User menu

  - Render `CurrentUserAvatar` and display name as a text Button at the Drawer bottom
  - Clicking opens a `Menu` with `Profile` and `Logout` (call `signOut()` from NextAuth)

- Performance
  - Memoize static route arrays; use `React.memo` for pure presentational subcomponents if they re-render frequently
  - Lazy-load the background effect
