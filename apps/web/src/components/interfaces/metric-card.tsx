import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@workspace/ui/components/card'

type MetricCardProps = {
    label: string
    value: string | number
}

export function MetricCard({ label, value }: MetricCardProps) {
    return (
        <Card>
            <CardHeader className='pb-2'>
                <CardTitle className='text-sm font-medium text-muted-foreground'>
                    {label}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className='text-2xl font-semibold'>{value}</div>
            </CardContent>
        </Card>
    )
}
