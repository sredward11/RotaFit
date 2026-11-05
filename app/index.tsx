import { Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ThemeProvider, useTheme } from '@/theme';

function Demo() {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.background,
        padding: 24,
        justifyContent: 'center',
        gap: 16,
      }}
    >
      <Card>
        <Text style={{ color: theme.text }}>Isto é um cartão de vidro.</Text>
      </Card>
      <Button title="Botão principal" onPress={() => {}} />
      <Button title="Botão secundário" variant="secondary" onPress={() => {}} />
    </View>
  );
}

export default function Home() {
  return (
    <ThemeProvider>
      <Demo />
    </ThemeProvider>
  );
}
